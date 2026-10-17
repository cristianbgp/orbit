import {
  and,
  asc,
  count,
  countDistinct,
  desc,
  eq,
  exists,
  inArray,
  isNotNull,
  isNull,
} from "drizzle-orm";

import type { createDatabase } from "../db/client";
import { member, user } from "../db/auth-schema";
import { caseActions } from "../db/case-action-schema";
import { caseUpdates } from "../db/case-update-schema";
import { client } from "../db/client-schema";
import { caseActivities, caseAssignments, legalCases } from "../db/case-schema";
import { accentInsensitiveMatchesAny } from "../db/search-text";
import { isStudioMemberPosition } from "../identity/studio-member-position";
import { resolveUserAlias } from "../identity/user-alias";
import type {
  CaseActor,
  CaseActivityRecord,
  CaseListFilters,
  CaseRecord,
  CaseStore,
  CaseValues,
} from "./case-service";

type Database = ReturnType<typeof createDatabase>["db"];
type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
type MutationSource = Database | Transaction;

const baseSelection = {
  id: legalCases.id,
  organizationId: legalCases.organizationId,
  clientId: legalCases.clientId,
  client: { id: client.id, name: client.name },
  identification: legalCases.identification,
  type: legalCases.type,
  subtype: legalCases.subtype,
  stage: legalCases.stage,
  entity: legalCases.entity,
  docketNumber: legalCases.docketNumber,
  tax: legalCases.tax,
  periodKind: legalCases.periodKind,
  periodStart: legalCases.periodStart,
  periodEnd: legalCases.periodEnd,
  amount: legalCases.amount,
  currency: legalCases.currency,
  claimantType: legalCases.claimantType,
  disputedMatter: legalCases.disputedMatter,
  challengedResolution: legalCases.challengedResolution,
  status: legalCases.status,
  result: legalCases.result,
  archivedAt: legalCases.archivedAt,
  createdByUserId: legalCases.createdByUserId,
  createdAt: legalCases.createdAt,
  updatedAt: legalCases.updatedAt,
};

function caseJoin() {
  return and(
    eq(legalCases.clientId, client.id),
    eq(legalCases.organizationId, client.organizationId),
  );
}

function whereCases(
  db: Database,
  organizationId: string,
  filters: CaseListFilters,
) {
  const search = filters.search
    ? accentInsensitiveMatchesAny(
        [
          legalCases.identification,
          legalCases.docketNumber,
          client.name,
          legalCases.claimantType,
          legalCases.disputedMatter,
          legalCases.challengedResolution,
        ],
        filters.search,
      )
    : undefined;
  return and(
    eq(legalCases.organizationId, organizationId),
    filters.archived
      ? isNotNull(legalCases.archivedAt)
      : isNull(legalCases.archivedAt),
    search,
    filters.types?.length ? inArray(legalCases.type, filters.types) : undefined,
    filters.statuses?.length
      ? inArray(legalCases.status, filters.statuses)
      : undefined,
    filters.clientIds?.length
      ? inArray(legalCases.clientId, filters.clientIds)
      : undefined,
    ...(filters.memberUserIds ?? []).map((userId) =>
      exists(
        db
          .select({ id: caseAssignments.id })
          .from(caseAssignments)
          .where(
            and(
              eq(caseAssignments.organizationId, organizationId),
              eq(caseAssignments.caseId, legalCases.id),
              eq(caseAssignments.userId, userId),
              isNull(caseAssignments.endedAt),
            ),
          ),
      ),
    ),
  );
}

function orderCases(filters: CaseListFilters) {
  const column = {
    identification: legalCases.identification,
    createdAt: legalCases.createdAt,
    updatedAt: legalCases.updatedAt,
  }[filters.orderBy ?? "updatedAt"];
  return filters.order === "asc" ? asc(column) : desc(column);
}

export function createDrizzleCaseStore(
  db: Database,
  createId: () => string = () => crypto.randomUUID(),
): CaseStore {
  async function actorIdentity(source: MutationSource, actor: CaseActor) {
    const rows = await source
      .select({ name: user.name })
      .from(member)
      .innerJoin(user, eq(member.userId, user.id))
      .where(
        and(
          eq(member.organizationId, actor.organizationId),
          eq(member.userId, actor.userId),
        ),
      )
      .limit(1);
    return rows[0] ?? null;
  }

  async function hydrateCases(
    records: Array<
      Omit<
        CaseRecord,
        "team" | "followers" | "activeActionCount" | "activeUpdateCount"
      >
    >,
  ) {
    if (!records.length) return [];
    const organizationId = records[0]!.organizationId;
    const caseIds = records.map(({ id }) => id);
    const [rows, actionCountRows, updateCountRows] = await Promise.all([
      db
        .select({
          caseId: caseAssignments.caseId,
          responsibility: caseAssignments.responsibility,
          userId: user.id,
          fullName: user.name,
          alias: user.alias,
          avatarColor: user.avatarColor,
          position: member.position,
        })
        .from(caseAssignments)
        .innerJoin(
          member,
          and(
            eq(member.organizationId, caseAssignments.organizationId),
            eq(member.userId, caseAssignments.userId),
          ),
        )
        .innerJoin(user, eq(user.id, member.userId))
        .where(
          and(
            eq(caseAssignments.organizationId, organizationId),
            inArray(caseAssignments.caseId, caseIds),
            isNull(caseAssignments.endedAt),
          ),
        ),
      db
        .select({ caseId: caseActions.caseId, value: count() })
        .from(caseActions)
        .where(
          and(
            eq(caseActions.organizationId, organizationId),
            inArray(caseActions.caseId, caseIds),
            isNull(caseActions.archivedAt),
          ),
        )
        .groupBy(caseActions.caseId),
      db
        .select({ caseId: caseUpdates.caseId, value: count() })
        .from(caseUpdates)
        .where(
          and(
            eq(caseUpdates.organizationId, organizationId),
            inArray(caseUpdates.caseId, caseIds),
            eq(caseUpdates.kind, "update"),
            isNull(caseUpdates.archivedAt),
          ),
        )
        .groupBy(caseUpdates.caseId),
    ]);
    const grouped = new Map<string, typeof rows>();
    const actionCounts = new Map(
      actionCountRows.map((row) => [row.caseId, row.value]),
    );
    const updateCounts = new Map(
      updateCountRows.map((row) => [row.caseId, row.value]),
    );
    for (const row of rows)
      grouped.set(row.caseId, [...(grouped.get(row.caseId) ?? []), row]);
    return records.map((record) => {
      const people = (responsibility: "member" | "follower") =>
        (grouped.get(record.id) ?? [])
          .filter((row) => row.responsibility === responsibility)
          .map((row) => ({
            userId: row.userId,
            fullName: row.fullName,
            alias: resolveUserAlias(row.alias, row.fullName),
            avatarColor: row.avatarColor,
            position: isStudioMemberPosition(row.position)
              ? row.position
              : null,
          }));
      const members = people("member");
      const followers = people("follower");
      return {
        ...record,
        team: { members, total: members.length },
        followers: { members: followers, total: followers.length },
        activeActionCount: actionCounts.get(record.id) ?? 0,
        activeUpdateCount: updateCounts.get(record.id) ?? 0,
      } as CaseRecord;
    });
  }

  async function getInternal(organizationId: string, caseId: string) {
    const rows = await db
      .select(baseSelection)
      .from(legalCases)
      .innerJoin(client, caseJoin())
      .where(
        and(
          eq(legalCases.organizationId, organizationId),
          eq(legalCases.id, caseId),
        ),
      )
      .limit(1);
    return (
      (
        await hydrateCases(
          rows as Array<
            Omit<
              CaseRecord,
              "team" | "followers" | "activeActionCount" | "activeUpdateCount"
            >
          >,
        )
      )[0] ?? null
    );
  }

  async function addActivity(
    source: MutationSource,
    actor: CaseActor,
    actorName: string,
    caseId: string,
    type: string,
    details: Record<string, string | null>,
    subject?: { id: string | null; name: string | null },
  ) {
    await source.insert(caseActivities).values({
      id: createId(),
      organizationId: actor.organizationId,
      caseId,
      type,
      actorUserId: actor.userId,
      actorNameSnapshot: actorName,
      subjectUserId: subject?.id ?? null,
      subjectNameSnapshot: subject?.name ?? null,
      details,
    });
  }

  return {
    async hasMembership(userId, organizationId) {
      const rows = await db
        .select({ id: member.id })
        .from(member)
        .where(
          and(
            eq(member.userId, userId),
            eq(member.organizationId, organizationId),
          ),
        )
        .limit(1);
      return rows.length > 0;
    },
    async findClient(organizationId, clientId) {
      const rows = await db
        .select({ id: client.id, name: client.name })
        .from(client)
        .where(
          and(
            eq(client.organizationId, organizationId),
            eq(client.id, clientId),
          ),
        )
        .limit(1);
      return rows[0] ?? null;
    },
    async list(organizationId, filters) {
      const scope = whereCases(db, organizationId, filters);
      const [rows, totals] = await Promise.all([
        db
          .select(baseSelection)
          .from(legalCases)
          .innerJoin(client, caseJoin())
          .where(scope)
          .orderBy(orderCases(filters), asc(legalCases.id))
          .limit(filters.pageSize)
          .offset((filters.page - 1) * filters.pageSize),
        db
          .select({ value: count() })
          .from(legalCases)
          .innerJoin(client, caseJoin())
          .where(scope),
      ]);
      return {
        cases: await hydrateCases(
          rows as Array<
            Omit<
              CaseRecord,
              "team" | "followers" | "activeActionCount" | "activeUpdateCount"
            >
          >,
        ),
        total: totals[0]?.value ?? 0,
      };
    },
    async listGroupedByClient(organizationId, filters) {
      const scope = whereCases(db, organizationId, filters);
      const [clientRows, totals] = await Promise.all([
        db
          .select({ id: client.id, name: client.name })
          .from(legalCases)
          .innerJoin(client, caseJoin())
          .where(scope)
          .groupBy(client.id, client.name)
          .orderBy(asc(client.name), asc(client.id))
          .limit(filters.pageSize)
          .offset((filters.page - 1) * filters.pageSize),
        db
          .select({ clientTotal: countDistinct(client.id), caseTotal: count() })
          .from(legalCases)
          .innerJoin(client, caseJoin())
          .where(scope),
      ]);
      if (!clientRows.length)
        return {
          groups: [],
          clientTotal: totals[0]?.clientTotal ?? 0,
          caseTotal: totals[0]?.caseTotal ?? 0,
        };
      const rows = await db
        .select(baseSelection)
        .from(legalCases)
        .innerJoin(client, caseJoin())
        .where(
          and(
            scope,
            inArray(
              legalCases.clientId,
              clientRows.map(({ id }) => id),
            ),
          ),
        )
        .orderBy(asc(client.name), orderCases(filters), asc(legalCases.id));
      const hydrated = await hydrateCases(
        rows as Array<
          Omit<
            CaseRecord,
            "team" | "followers" | "activeActionCount" | "activeUpdateCount"
          >
        >,
      );
      return {
        groups: clientRows.map((clientRecord) => ({
          client: clientRecord,
          cases: hydrated.filter(
            (record) => record.clientId === clientRecord.id,
          ),
        })),
        clientTotal: totals[0]?.clientTotal ?? 0,
        caseTotal: totals[0]?.caseTotal ?? 0,
      };
    },
    get: getInternal,
    async create(actor, caseId, values, assignments) {
      const result = await db.transaction(async (tx) => {
        const actorRecord = await actorIdentity(tx, actor);
        if (!actorRecord) return { status: "member_not_found" as const };
        const clients = await tx
          .select({ id: client.id })
          .from(client)
          .where(
            and(
              eq(client.organizationId, actor.organizationId),
              eq(client.id, values.clientId),
            ),
          )
          .limit(1);
        if (!clients.length) return { status: "client_not_found" as const };
        const userIds = [
          ...new Set([...assignments.members, ...assignments.followers]),
        ];
        const initialMembers = userIds.length
          ? await tx
              .select({ userId: user.id, name: user.name, email: user.email })
              .from(member)
              .innerJoin(user, eq(user.id, member.userId))
              .where(
                and(
                  eq(member.organizationId, actor.organizationId),
                  inArray(member.userId, userIds),
                ),
              )
          : [];
        if (initialMembers.length !== userIds.length)
          return { status: "member_not_found" as const };
        await tx.insert(legalCases).values({
          id: caseId,
          organizationId: actor.organizationId,
          createdByUserId: actor.userId,
          ...values,
        });
        await addActivity(tx, actor, actorRecord.name, caseId, "case.created", {
          identification: values.identification,
        });
        for (const [responsibility, ids] of [
          ["member", assignments.members],
          ["follower", assignments.followers],
        ] as const)
          for (const assigned of initialMembers.filter(({ userId }) =>
            ids.includes(userId),
          )) {
            const assignmentId = createId();
            await tx.insert(caseAssignments).values({
              id: assignmentId,
              organizationId: actor.organizationId,
              caseId,
              userId: assigned.userId,
              userNameSnapshot: assigned.name,
              userEmailSnapshot: assigned.email,
              responsibility,
              assignedByUserId: actor.userId,
              assignedByNameSnapshot: actorRecord.name,
            });
            await addActivity(
              tx,
              actor,
              actorRecord.name,
              caseId,
              "case_assignment.added",
              { assignmentId, responsibility },
              { id: assigned.userId, name: assigned.name },
            );
          }
        return { status: "created" as const };
      });
      if (result.status !== "created") return result;
      return {
        status: "created",
        case: (await getInternal(actor.organizationId, caseId))!,
      };
    },
    async update(actor, caseId, values) {
      const result = await db.transaction(async (tx) => {
        const [actorRecord, current] = await Promise.all([
          actorIdentity(tx, actor),
          tx
            .select()
            .from(legalCases)
            .where(
              and(
                eq(legalCases.organizationId, actor.organizationId),
                eq(legalCases.id, caseId),
              ),
            )
            .limit(1),
        ]);
        if (!actorRecord || !current[0])
          return { status: "not_found" as const };
        if (current[0].archivedAt) return { status: "case_archived" as const };
        if (values.clientId) {
          const clients = await tx
            .select({ id: client.id })
            .from(client)
            .where(
              and(
                eq(client.organizationId, actor.organizationId),
                eq(client.id, values.clientId),
              ),
            )
            .limit(1);
          if (!clients.length) return { status: "client_not_found" as const };
        }
        const details: Record<string, string | null> = {};
        for (const [key, next] of Object.entries(values)) {
          const previous = current[0][key as keyof (typeof current)[0]];
          const before = previous == null ? null : String(previous);
          const after = next == null ? null : String(next);
          if (before !== after) {
            details[`previous${key[0]!.toUpperCase()}${key.slice(1)}`] = before;
            details[`new${key[0]!.toUpperCase()}${key.slice(1)}`] = after;
          }
        }
        const addCompleteGroupSnapshot = (keys: Array<keyof CaseValues>) => {
          const changed = keys.some((key) => {
            const suffix = `${String(key)[0]!.toUpperCase()}${String(key).slice(1)}`;
            return (
              Object.prototype.hasOwnProperty.call(
                details,
                `previous${suffix}`,
              ) || Object.prototype.hasOwnProperty.call(details, `new${suffix}`)
            );
          });
          if (!changed) return;
          for (const key of keys) {
            const suffix = `${String(key)[0]!.toUpperCase()}${String(key).slice(1)}`;
            const previous = current[0][key];
            const next = Object.prototype.hasOwnProperty.call(values, key)
              ? values[key]
              : previous;
            details[`previous${suffix}`] =
              previous == null ? null : String(previous);
            details[`new${suffix}`] = next == null ? null : String(next);
          }
        };
        addCompleteGroupSnapshot(["periodKind", "periodStart", "periodEnd"]);
        addCompleteGroupSnapshot(["amount", "currency"]);
        if (
          details.previousClientId !== undefined ||
          details.previousClaimantType !== undefined
        ) {
          const nextClientId = values.clientId ?? current[0].clientId;
          const clientRows = await tx
            .select({ id: client.id, name: client.name })
            .from(client)
            .where(
              and(
                eq(client.organizationId, actor.organizationId),
                inArray(client.id, [current[0].clientId, nextClientId]),
              ),
            );
          const names = new Map(clientRows.map((item) => [item.id, item.name]));
          details.previousClientName = names.get(current[0].clientId) ?? null;
          details.newClientName = names.get(nextClientId) ?? null;
        }
        if (!Object.keys(details).length)
          return { status: "unchanged" as const };
        await tx
          .update(legalCases)
          .set({ ...values, updatedAt: new Date() })
          .where(
            and(
              eq(legalCases.organizationId, actor.organizationId),
              eq(legalCases.id, caseId),
            ),
          );
        await addActivity(
          tx,
          actor,
          actorRecord.name,
          caseId,
          "case.updated",
          details,
        );
        return { status: "updated" as const };
      });
      if (result.status !== "updated" && result.status !== "unchanged")
        return result;
      return {
        status: result.status,
        case: (await getInternal(actor.organizationId, caseId))!,
      };
    },
    async archive(actor, caseId) {
      const result = await db.transaction(async (tx) => {
        const [actorRecord, rows] = await Promise.all([
          actorIdentity(tx, actor),
          tx
            .select({ archivedAt: legalCases.archivedAt })
            .from(legalCases)
            .where(
              and(
                eq(legalCases.organizationId, actor.organizationId),
                eq(legalCases.id, caseId),
              ),
            )
            .limit(1),
        ]);
        if (!actorRecord || !rows[0]) return "not_found" as const;
        if (rows[0].archivedAt) return "conflict" as const;
        await tx
          .update(legalCases)
          .set({ archivedAt: new Date(), updatedAt: new Date() })
          .where(eq(legalCases.id, caseId));
        await addActivity(
          tx,
          actor,
          actorRecord.name,
          caseId,
          "case.archived",
          {},
        );
        return "updated" as const;
      });
      return result === "updated"
        ? {
            status: "updated",
            case: (await getInternal(actor.organizationId, caseId))!,
          }
        : { status: result };
    },
    async restore(actor, caseId) {
      const result = await db.transaction(async (tx) => {
        const [actorRecord, rows] = await Promise.all([
          actorIdentity(tx, actor),
          tx
            .select({ archivedAt: legalCases.archivedAt })
            .from(legalCases)
            .where(
              and(
                eq(legalCases.organizationId, actor.organizationId),
                eq(legalCases.id, caseId),
              ),
            )
            .limit(1),
        ]);
        if (!actorRecord || !rows[0]) return "not_found" as const;
        if (!rows[0].archivedAt) return "conflict" as const;
        await tx
          .update(legalCases)
          .set({ archivedAt: null, updatedAt: new Date() })
          .where(eq(legalCases.id, caseId));
        await addActivity(
          tx,
          actor,
          actorRecord.name,
          caseId,
          "case.restored",
          {},
        );
        return "updated" as const;
      });
      return result === "updated"
        ? {
            status: "updated",
            case: (await getInternal(actor.organizationId, caseId))!,
          }
        : { status: result };
    },
    async listAssignments(
      organizationId,
      caseId,
      { responsibility, historyPage, historyPageSize },
    ) {
      if (!(await getInternal(organizationId, caseId))) return null;
      const scope = and(
        eq(caseAssignments.organizationId, organizationId),
        eq(caseAssignments.caseId, caseId),
        eq(caseAssignments.responsibility, responsibility),
      );
      const selection = {
        id: caseAssignments.id,
        userId: caseAssignments.userId,
        userName: caseAssignments.userNameSnapshot,
        userEmail: caseAssignments.userEmailSnapshot,
        assignedAt: caseAssignments.assignedAt,
        endedAt: caseAssignments.endedAt,
        responsibility: caseAssignments.responsibility,
        currentMemberId: member.id,
        currentName: user.name,
        alias: user.alias,
        avatarColor: user.avatarColor,
        position: member.position,
      };
      const query = () =>
        db
          .select(selection)
          .from(caseAssignments)
          .leftJoin(
            member,
            and(
              eq(member.organizationId, organizationId),
              eq(member.userId, caseAssignments.userId),
            ),
          )
          .leftJoin(user, eq(user.id, member.userId));
      const [active, history, totals] = await Promise.all([
        query()
          .where(and(scope, isNull(caseAssignments.endedAt)))
          .orderBy(asc(caseAssignments.userNameSnapshot)),
        query()
          .where(and(scope, isNotNull(caseAssignments.endedAt)))
          .orderBy(desc(caseAssignments.endedAt))
          .limit(historyPageSize)
          .offset((historyPage - 1) * historyPageSize),
        db
          .select({ value: count() })
          .from(caseAssignments)
          .where(and(scope, isNotNull(caseAssignments.endedAt))),
      ]);
      const present = (row: (typeof active)[number]) => ({
        id: row.id,
        userId: row.userId,
        userName: row.userName,
        userEmail: row.userEmail,
        userAlias: resolveUserAlias(row.alias, row.currentName ?? row.userName),
        userAvatarColor: row.avatarColor,
        position: isStudioMemberPosition(row.position) ? row.position : null,
        activeStudioMember: row.currentMemberId !== null,
        assignedAt: row.assignedAt,
        endedAt: row.endedAt,
        responsibility: row.responsibility,
      });
      return {
        active: active.map(present),
        history: history.map(present),
        historyTotal: totals[0]?.value ?? 0,
      };
    },
    async listCandidates(organizationId, caseId, responsibility) {
      if (!(await getInternal(organizationId, caseId))) return null;
      const rows = await db
        .select({
          userId: user.id,
          fullName: user.name,
          alias: user.alias,
          avatarColor: user.avatarColor,
          position: member.position,
        })
        .from(member)
        .innerJoin(user, eq(user.id, member.userId))
        .where(eq(member.organizationId, organizationId));
      const active = await db
        .select({ userId: caseAssignments.userId })
        .from(caseAssignments)
        .where(
          and(
            eq(caseAssignments.organizationId, organizationId),
            eq(caseAssignments.caseId, caseId),
            eq(caseAssignments.responsibility, responsibility),
            isNull(caseAssignments.endedAt),
          ),
        );
      const assigned = new Set(active.map(({ userId }) => userId));
      return rows
        .filter((row) => !assigned.has(row.userId))
        .map((row) => ({
          userId: row.userId,
          fullName: row.fullName,
          alias: resolveUserAlias(row.alias, row.fullName),
          avatarColor: row.avatarColor,
          position: isStudioMemberPosition(row.position) ? row.position : null,
        }));
    },
    async addAssignments(actor, caseId, userIds, responsibility) {
      if (!userIds.length) return { status: "conflict" };
      return db.transaction(async (tx) => {
        const [actorRecord, records] = await Promise.all([
          actorIdentity(tx, actor),
          tx
            .select({ archivedAt: legalCases.archivedAt })
            .from(legalCases)
            .where(
              and(
                eq(legalCases.organizationId, actor.organizationId),
                eq(legalCases.id, caseId),
              ),
            )
            .limit(1),
        ]);
        if (!actorRecord || !records[0])
          return { status: "not_found" } as const;
        if (records[0].archivedAt) return { status: "case_archived" } as const;
        const members = await tx
          .select({ userId: user.id, name: user.name, email: user.email })
          .from(member)
          .innerJoin(user, eq(user.id, member.userId))
          .where(
            and(
              eq(member.organizationId, actor.organizationId),
              inArray(member.userId, userIds),
            ),
          );
        if (members.length !== userIds.length)
          return { status: "member_not_found" } as const;
        const existing = await tx
          .select({ userId: caseAssignments.userId })
          .from(caseAssignments)
          .where(
            and(
              eq(caseAssignments.caseId, caseId),
              inArray(caseAssignments.userId, userIds),
              eq(caseAssignments.responsibility, responsibility),
              isNull(caseAssignments.endedAt),
            ),
          );
        if (existing.length) return { status: "conflict" } as const;
        for (const assigned of members) {
          const id = createId();
          await tx.insert(caseAssignments).values({
            id,
            organizationId: actor.organizationId,
            caseId,
            userId: assigned.userId,
            userNameSnapshot: assigned.name,
            userEmailSnapshot: assigned.email,
            responsibility,
            assignedByUserId: actor.userId,
            assignedByNameSnapshot: actorRecord.name,
          });
          await addActivity(
            tx,
            actor,
            actorRecord.name,
            caseId,
            "case_assignment.added",
            { assignmentId: id, responsibility },
            { id: assigned.userId, name: assigned.name },
          );
        }
        return { status: "updated" } as const;
      });
    },
    async endAssignment(actor, caseId, assignmentId) {
      return db.transaction(async (tx) => {
        const [actorRecord, records] = await Promise.all([
          actorIdentity(tx, actor),
          tx
            .select({ archivedAt: legalCases.archivedAt })
            .from(legalCases)
            .where(
              and(
                eq(legalCases.organizationId, actor.organizationId),
                eq(legalCases.id, caseId),
              ),
            )
            .limit(1),
        ]);
        if (!actorRecord || !records[0])
          return { status: "not_found" } as const;
        if (records[0].archivedAt) return { status: "case_archived" } as const;
        const assignments = await tx
          .select()
          .from(caseAssignments)
          .where(
            and(
              eq(caseAssignments.organizationId, actor.organizationId),
              eq(caseAssignments.caseId, caseId),
              eq(caseAssignments.id, assignmentId),
              isNull(caseAssignments.endedAt),
            ),
          )
          .limit(1);
        if (!assignments[0]) return { status: "not_found" } as const;
        await tx
          .update(caseAssignments)
          .set({
            endedAt: new Date(),
            endedByUserId: actor.userId,
            endedByNameSnapshot: actorRecord.name,
            endReason: "case_unassigned",
          })
          .where(eq(caseAssignments.id, assignmentId));
        await addActivity(
          tx,
          actor,
          actorRecord.name,
          caseId,
          "case_assignment.removed",
          { assignmentId, responsibility: assignments[0].responsibility },
          { id: assignments[0].userId, name: assignments[0].userNameSnapshot },
        );
        return { status: "updated" } as const;
      });
    },
    async listActivities(organizationId, caseId, { page, pageSize }) {
      if (!(await getInternal(organizationId, caseId))) return null;
      const scope = and(
        eq(caseActivities.organizationId, organizationId),
        eq(caseActivities.caseId, caseId),
      );
      const [rows, totals] = await Promise.all([
        db
          .select()
          .from(caseActivities)
          .where(scope)
          .orderBy(desc(caseActivities.createdAt), desc(caseActivities.id))
          .limit(pageSize)
          .offset((page - 1) * pageSize),
        db.select({ value: count() }).from(caseActivities).where(scope),
      ]);
      const userIds = [
        ...new Set(
          rows.flatMap((row) =>
            [row.actorUserId, row.subjectUserId].filter(
              (id): id is string => id !== null,
            ),
          ),
        ),
      ];
      const identities = userIds.length
        ? await db
            .select({
              id: user.id,
              name: user.name,
              alias: user.alias,
              avatarColor: user.avatarColor,
            })
            .from(member)
            .innerJoin(user, eq(user.id, member.userId))
            .where(
              and(
                eq(member.organizationId, organizationId),
                inArray(member.userId, userIds),
              ),
            )
        : [];
      const byId = new Map(
        identities.map((identity) => [identity.id, identity]),
      );
      const identity = (userId: string | null, nameSnapshot: string) => {
        const current = userId ? byId.get(userId) : undefined;
        return {
          userId,
          nameSnapshot,
          alias: current ? resolveUserAlias(current.alias, current.name) : null,
          avatarColor: current?.avatarColor ?? null,
          activeStudioMember: current !== undefined,
          linkable: userId !== null && current !== undefined,
        };
      };
      const activities: CaseActivityRecord[] = rows.map((row) => ({
        id: row.id,
        type: row.type,
        actor: identity(row.actorUserId, row.actorNameSnapshot),
        subject: row.subjectNameSnapshot
          ? identity(row.subjectUserId, row.subjectNameSnapshot)
          : null,
        details: row.details,
        createdAt: row.createdAt,
      }));
      return { activities, total: totals[0]?.value ?? 0 };
    },
  };
}
