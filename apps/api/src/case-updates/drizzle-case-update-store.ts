import { and, count, desc, eq, inArray, isNotNull, isNull } from "drizzle-orm";

import { member, user } from "../db/auth-schema";
import { caseUpdates } from "../db/case-update-schema";
import { caseActivities, legalCases } from "../db/case-schema";
import type { createDatabase } from "../db/client";
import { resolveUserAlias } from "../identity/user-alias";
import type { CaseUpdateStore } from "./case-update-service";
import type {
  CaseUpdateActor,
  CaseUpdateRecord,
  CaseUpdateValues,
} from "./case-update-types";

type Database = ReturnType<typeof createDatabase>["db"];
type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];

const updateSelection = {
  id: caseUpdates.id,
  organizationId: caseUpdates.organizationId,
  caseId: caseUpdates.caseId,
  date: caseUpdates.date,
  description: caseUpdates.description,
  kind: caseUpdates.kind,
  createdByUserId: caseUpdates.createdByUserId,
  creatorName: user.name,
  creatorAlias: user.alias,
  creatorAvatarColor: user.avatarColor,
  creatorMemberId: member.id,
  createdAt: caseUpdates.createdAt,
  updatedAt: caseUpdates.updatedAt,
  archivedAt: caseUpdates.archivedAt,
};

type UpdateRow = {
  id: string;
  organizationId: string;
  caseId: string;
  date: string;
  description: string;
  kind: "update" | "background";
  createdByUserId: string | null;
  creatorName: string | null;
  creatorAlias: string | null;
  creatorAvatarColor: string | null;
  creatorMemberId: string | null;
  createdAt: Date;
  updatedAt: Date;
  archivedAt: Date | null;
};

function presentUpdate(row: UpdateRow): CaseUpdateRecord {
  const fullName = row.creatorName ?? "Usuario no disponible";
  const activeStudioMember = row.creatorMemberId !== null;
  return {
    id: row.id,
    organizationId: row.organizationId,
    caseId: row.caseId,
    date: row.date,
    description: row.description,
    kind: row.kind,
    creator: {
      userId: row.createdByUserId,
      fullName,
      alias: row.creatorName
        ? resolveUserAlias(row.creatorAlias, row.creatorName)
        : null,
      avatarColor: row.creatorAvatarColor,
      activeStudioMember,
      linkable: row.createdByUserId !== null && activeStudioMember,
    },
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    archivedAt: row.archivedAt,
  };
}

function updateJoins(source: Database | Transaction) {
  return source
    .select(updateSelection)
    .from(caseUpdates)
    .leftJoin(user, eq(user.id, caseUpdates.createdByUserId))
    .leftJoin(
      member,
      and(
        eq(member.organizationId, caseUpdates.organizationId),
        eq(member.userId, caseUpdates.createdByUserId),
      ),
    );
}

function activityDetails(update: {
  id: string;
  date: string;
  description: string;
  kind: "update" | "background";
}) {
  return {
    updateId: update.id,
    date: update.date,
    description: update.description,
    kind: update.kind,
  };
}

export function createDrizzleCaseUpdateStore(
  db: Database,
  createId: () => string = () => crypto.randomUUID(),
): CaseUpdateStore {
  async function actorIdentity(
    transaction: Transaction,
    actor: CaseUpdateActor,
  ) {
    const rows = await transaction
      .select({ userId: user.id, name: user.name })
      .from(member)
      .innerJoin(user, eq(user.id, member.userId))
      .where(
        and(
          eq(member.organizationId, actor.organizationId),
          eq(member.userId, actor.userId),
        ),
      )
      .limit(1)
      .for("share");
    return rows[0] ?? null;
  }

  async function parentCase(
    transaction: Transaction,
    actor: CaseUpdateActor,
    caseId: string,
  ) {
    const rows = await transaction
      .select({ id: legalCases.id, archivedAt: legalCases.archivedAt })
      .from(legalCases)
      .where(
        and(
          eq(legalCases.organizationId, actor.organizationId),
          eq(legalCases.id, caseId),
        ),
      )
      .limit(1)
      .for("update");
    return rows[0] ?? null;
  }

  async function getInternal(
    organizationId: string,
    caseId: string,
    updateId: string,
  ) {
    const rows = await updateJoins(db)
      .where(
        and(
          eq(caseUpdates.organizationId, organizationId),
          eq(caseUpdates.caseId, caseId),
          eq(caseUpdates.id, updateId),
        ),
      )
      .limit(1);
    return rows[0] ? presentUpdate(rows[0]) : null;
  }

  async function addActivity(
    transaction: Transaction,
    actor: CaseUpdateActor,
    actorName: string,
    caseId: string,
    type: string,
    details: Record<string, string | null>,
    createdAt: Date,
  ) {
    await transaction.insert(caseActivities).values({
      id: createId(),
      organizationId: actor.organizationId,
      caseId,
      type,
      actorUserId: actor.userId,
      actorNameSnapshot: actorName,
      details,
      createdAt,
    });
  }

  async function currentUpdate(
    transaction: Transaction,
    actor: CaseUpdateActor,
    caseId: string,
    updateId: string,
  ) {
    const rows = await transaction
      .select()
      .from(caseUpdates)
      .where(
        and(
          eq(caseUpdates.organizationId, actor.organizationId),
          eq(caseUpdates.caseId, caseId),
          eq(caseUpdates.id, updateId),
        ),
      )
      .limit(1)
      .for("update");
    return rows[0] ?? null;
  }

  function versionMatches(updatedAt: Date, expectedUpdatedAt: string) {
    return updatedAt.toISOString() === expectedUpdatedAt;
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

    async list(organizationId, caseId, input) {
      const cases = await db
        .select({ id: legalCases.id })
        .from(legalCases)
        .where(
          and(
            eq(legalCases.organizationId, organizationId),
            eq(legalCases.id, caseId),
          ),
        )
        .limit(1);
      if (!cases[0]) return null;

      const lifecycle =
        input.status === "archived"
          ? isNotNull(caseUpdates.archivedAt)
          : isNull(caseUpdates.archivedAt);
      const scope = and(
        eq(caseUpdates.organizationId, organizationId),
        eq(caseUpdates.caseId, caseId),
        lifecycle,
        input.kind ? eq(caseUpdates.kind, input.kind) : undefined,
      );
      const [rows, totals] = await Promise.all([
        updateJoins(db)
          .where(scope)
          .orderBy(
            desc(caseUpdates.date),
            desc(caseUpdates.createdAt),
            desc(caseUpdates.id),
          )
          .limit(input.pageSize)
          .offset((input.page - 1) * input.pageSize),
        db.select({ value: count() }).from(caseUpdates).where(scope),
      ]);
      return {
        updates: rows.map(presentUpdate),
        total: totals[0]?.value ?? 0,
      };
    },

    async create(actor, caseId, updateId, values) {
      const result = await db.transaction(async (transaction) => {
        const identity = await actorIdentity(transaction, actor);
        if (!identity) return { status: "forbidden" as const };
        const caseRecord = await parentCase(transaction, actor, caseId);
        if (!caseRecord) return { status: "not_found" as const };
        if (caseRecord.archivedAt) {
          return { status: "case_archived" as const };
        }

        const createdAt = new Date();
        await transaction.insert(caseUpdates).values({
          id: updateId,
          organizationId: actor.organizationId,
          caseId,
          ...values,
          createdByUserId: actor.userId,
          createdAt,
          updatedAt: createdAt,
        });
        await addActivity(
          transaction,
          actor,
          identity.name,
          caseId,
          "case.update_created",
          activityDetails({ id: updateId, ...values }),
          createdAt,
        );
        return { status: "created" as const };
      });
      if (result.status !== "created") return result;
      return {
        status: "created",
        update: (await getInternal(actor.organizationId, caseId, updateId))!,
      };
    },

    async update(actor, caseId, updateId, values, expectedUpdatedAt) {
      const result = await db.transaction(async (transaction) => {
        const identity = await actorIdentity(transaction, actor);
        if (!identity) return { status: "forbidden" as const };
        const caseRecord = await parentCase(transaction, actor, caseId);
        if (!caseRecord) return { status: "not_found" as const };
        if (caseRecord.archivedAt) {
          return { status: "case_archived" as const };
        }
        const current = await currentUpdate(
          transaction,
          actor,
          caseId,
          updateId,
        );
        if (!current) return { status: "not_found" as const };
        if (!versionMatches(current.updatedAt, expectedUpdatedAt)) {
          return { status: "conflict" as const };
        }
        if (current.archivedAt) return { status: "conflict" as const };

        const next: CaseUpdateValues = { ...current, ...values };
        if (
          next.date === current.date &&
          next.description === current.description &&
          next.kind === current.kind
        ) {
          return { status: "unchanged" as const };
        }
        const updatedAt = new Date();
        await transaction
          .update(caseUpdates)
          .set({ ...values, updatedAt })
          .where(
            and(
              eq(caseUpdates.organizationId, actor.organizationId),
              eq(caseUpdates.caseId, caseId),
              eq(caseUpdates.id, updateId),
            ),
          );
        await addActivity(
          transaction,
          actor,
          identity.name,
          caseId,
          "case.update_changed",
          {
            ...activityDetails(current),
            newDate: next.date,
            newDescription: next.description,
            newKind: next.kind,
          },
          updatedAt,
        );
        return { status: "updated" as const };
      });
      if (result.status !== "updated" && result.status !== "unchanged") {
        return result;
      }
      return {
        status: result.status,
        update: (await getInternal(actor.organizationId, caseId, updateId))!,
      };
    },

    async archive(actor, caseId, updateId, expectedUpdatedAt) {
      const result = await db.transaction(async (transaction) => {
        const identity = await actorIdentity(transaction, actor);
        if (!identity) return { status: "forbidden" as const };
        const caseRecord = await parentCase(transaction, actor, caseId);
        if (!caseRecord) return { status: "not_found" as const };
        if (caseRecord.archivedAt) {
          return { status: "case_archived" as const };
        }
        const current = await currentUpdate(
          transaction,
          actor,
          caseId,
          updateId,
        );
        if (!current) return { status: "not_found" as const };
        if (!versionMatches(current.updatedAt, expectedUpdatedAt)) {
          return { status: "conflict" as const };
        }
        if (current.archivedAt) return { status: "unchanged" as const };

        const updatedAt = new Date();
        await transaction
          .update(caseUpdates)
          .set({
            archivedAt: updatedAt,
            archivedByUserId: actor.userId,
            updatedAt,
          })
          .where(eq(caseUpdates.id, updateId));
        await addActivity(
          transaction,
          actor,
          identity.name,
          caseId,
          "case.update_archived",
          activityDetails(current),
          updatedAt,
        );
        return { status: "updated" as const };
      });
      if (result.status !== "updated" && result.status !== "unchanged") {
        return result;
      }
      return {
        status: result.status,
        update: (await getInternal(actor.organizationId, caseId, updateId))!,
      };
    },

    async restore(actor, caseId, updateId, expectedUpdatedAt) {
      const result = await db.transaction(async (transaction) => {
        const identity = await actorIdentity(transaction, actor);
        if (!identity) return { status: "forbidden" as const };
        const caseRecord = await parentCase(transaction, actor, caseId);
        if (!caseRecord) return { status: "not_found" as const };
        if (caseRecord.archivedAt) {
          return { status: "case_archived" as const };
        }
        const current = await currentUpdate(
          transaction,
          actor,
          caseId,
          updateId,
        );
        if (!current) return { status: "not_found" as const };
        if (!versionMatches(current.updatedAt, expectedUpdatedAt)) {
          return { status: "conflict" as const };
        }
        if (!current.archivedAt) return { status: "unchanged" as const };

        const updatedAt = new Date();
        await transaction
          .update(caseUpdates)
          .set({
            archivedAt: null,
            archivedByUserId: null,
            updatedAt,
          })
          .where(eq(caseUpdates.id, updateId));
        await addActivity(
          transaction,
          actor,
          identity.name,
          caseId,
          "case.update_restored",
          activityDetails(current),
          updatedAt,
        );
        return { status: "updated" as const };
      });
      if (result.status !== "updated" && result.status !== "unchanged") {
        return result;
      }
      return {
        status: result.status,
        update: (await getInternal(actor.organizationId, caseId, updateId))!,
      };
    },

    async previewMoveAllToBackground(organizationId) {
      const rows = await db
        .select({ caseId: caseUpdates.caseId })
        .from(caseUpdates)
        .innerJoin(legalCases, eq(legalCases.id, caseUpdates.caseId))
        .where(
          and(
            eq(caseUpdates.organizationId, organizationId),
            eq(legalCases.organizationId, organizationId),
            eq(caseUpdates.kind, "update"),
            isNull(caseUpdates.archivedAt),
            isNull(legalCases.archivedAt),
          ),
        );
      return {
        movedCount: rows.length,
        caseCount: new Set(rows.map((row) => row.caseId)).size,
      };
    },

    async moveAllToBackground(actor) {
      return db.transaction(async (transaction) => {
        const identity = await actorIdentity(transaction, actor);
        if (!identity) return { status: "forbidden" as const };

        const candidates = await transaction
          .select({ id: caseUpdates.id, caseId: caseUpdates.caseId })
          .from(caseUpdates)
          .innerJoin(legalCases, eq(legalCases.id, caseUpdates.caseId))
          .where(
            and(
              eq(caseUpdates.organizationId, actor.organizationId),
              eq(legalCases.organizationId, actor.organizationId),
              eq(caseUpdates.kind, "update"),
              isNull(caseUpdates.archivedAt),
              isNull(legalCases.archivedAt),
            ),
          );
        const caseIds = new Map<string, number>();
        for (const candidate of candidates) {
          caseIds.set(
            candidate.caseId,
            (caseIds.get(candidate.caseId) ?? 0) + 1,
          );
        }
        if (!candidates.length) {
          return {
            status: "unchanged" as const,
            movedCount: 0,
            caseCount: 0,
          };
        }

        const updatedAt = new Date();
        await transaction
          .update(caseUpdates)
          .set({ kind: "background", updatedAt })
          .where(
            inArray(
              caseUpdates.id,
              candidates.map((item) => item.id),
            ),
          );
        for (const [caseId, movedCount] of caseIds) {
          await addActivity(
            transaction,
            actor,
            identity.name,
            caseId,
            "case.updates_moved_to_background",
            { count: String(movedCount) },
            updatedAt,
          );
        }
        return {
          status: "updated" as const,
          movedCount: candidates.length,
          caseCount: caseIds.size,
        };
      });
    },
  };
}
