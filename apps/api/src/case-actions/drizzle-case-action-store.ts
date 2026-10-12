import { and, count, desc, eq, isNotNull, isNull } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import { member, user } from "../db/auth-schema";
import { caseActions } from "../db/case-action-schema";
import { caseActivities, caseAssignments, legalCases } from "../db/case-schema";
import type { createDatabase } from "../db/client";
import { resolveUserAlias } from "../identity/user-alias";
import type { CaseActionStore } from "./case-action-service";
import type {
  CaseActionActor,
  CaseActionIdentity,
  CaseActionRecord,
} from "./case-action-types";

type Database = ReturnType<typeof createDatabase>["db"];
type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
const assigneeUser = alias(user, "case_action_assignee_user");
const assigneeMember = alias(member, "case_action_assignee_member");
const assigneeCaseMember = alias(
  caseAssignments,
  "case_action_assignee_case_member",
);
const creatorUser = alias(user, "case_action_creator_user");
const creatorMember = alias(member, "case_action_creator_member");

const selection = {
  id: caseActions.id,
  organizationId: caseActions.organizationId,
  caseId: caseActions.caseId,
  description: caseActions.description,
  status: caseActions.status,
  assigneeUserId: caseActions.assigneeUserId,
  assigneeNameSnapshot: caseActions.assigneeNameSnapshot,
  assigneeName: assigneeUser.name,
  assigneeAlias: assigneeUser.alias,
  assigneeAvatarColor: assigneeUser.avatarColor,
  assigneeStudioMemberId: assigneeMember.id,
  assigneeCaseMemberId: assigneeCaseMember.id,
  creatorUserId: caseActions.createdByUserId,
  creatorName: creatorUser.name,
  creatorAlias: creatorUser.alias,
  creatorAvatarColor: creatorUser.avatarColor,
  creatorMemberId: creatorMember.id,
  completedAt: caseActions.completedAt,
  completedByUserId: caseActions.completedByUserId,
  createdAt: caseActions.createdAt,
  updatedAt: caseActions.updatedAt,
  archivedAt: caseActions.archivedAt,
};

function joined(source: Database | Transaction) {
  return source
    .select(selection)
    .from(caseActions)
    .leftJoin(assigneeUser, eq(assigneeUser.id, caseActions.assigneeUserId))
    .leftJoin(
      assigneeMember,
      and(
        eq(assigneeMember.organizationId, caseActions.organizationId),
        eq(assigneeMember.userId, caseActions.assigneeUserId),
      ),
    )
    .leftJoin(
      assigneeCaseMember,
      and(
        eq(assigneeCaseMember.organizationId, caseActions.organizationId),
        eq(assigneeCaseMember.caseId, caseActions.caseId),
        eq(assigneeCaseMember.userId, caseActions.assigneeUserId),
        eq(assigneeCaseMember.responsibility, "member"),
        isNull(assigneeCaseMember.endedAt),
      ),
    )
    .leftJoin(creatorUser, eq(creatorUser.id, caseActions.createdByUserId))
    .leftJoin(
      creatorMember,
      and(
        eq(creatorMember.organizationId, caseActions.organizationId),
        eq(creatorMember.userId, caseActions.createdByUserId),
      ),
    );
}

type JoinedRow = Awaited<
  ReturnType<ReturnType<typeof joined>["execute"]>
>[number];

function identity(values: {
  userId: string | null;
  name: string | null;
  snapshot?: string | null;
  alias: string | null;
  avatarColor: string | null;
  studioMemberId: string | null;
  caseMemberId?: string | null;
}): CaseActionIdentity | null {
  const fullName = values.name ?? values.snapshot ?? null;
  if (!fullName) return null;
  const activeStudioMember = values.studioMemberId !== null;
  return {
    userId: values.userId,
    fullName,
    alias: values.name ? resolveUserAlias(values.alias, values.name) : null,
    avatarColor: values.avatarColor,
    activeStudioMember,
    activeCaseMember:
      values.caseMemberId === undefined
        ? activeStudioMember
        : values.caseMemberId !== null,
    linkable: values.userId !== null && activeStudioMember,
  };
}

function present(row: JoinedRow): CaseActionRecord {
  return {
    id: row.id,
    organizationId: row.organizationId,
    caseId: row.caseId,
    description: row.description,
    status: row.status,
    assignee: identity({
      userId: row.assigneeUserId,
      name: row.assigneeName,
      snapshot: row.assigneeNameSnapshot,
      alias: row.assigneeAlias,
      avatarColor: row.assigneeAvatarColor,
      studioMemberId: row.assigneeStudioMemberId,
      caseMemberId: row.assigneeCaseMemberId,
    }),
    creator: identity({
      userId: row.creatorUserId,
      name: row.creatorName,
      alias: row.creatorAlias,
      avatarColor: row.creatorAvatarColor,
      studioMemberId: row.creatorMemberId,
    }) ?? {
      userId: null,
      fullName: "Usuario no disponible",
      alias: null,
      avatarColor: null,
      activeStudioMember: false,
      activeCaseMember: false,
      linkable: false,
    },
    completedAt: row.completedAt,
    completedByUserId: row.completedByUserId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    archivedAt: row.archivedAt,
  };
}

function nextInstant(previous: Date) {
  return new Date(Math.max(Date.now(), previous.getTime() + 1));
}

export function createDrizzleCaseActionStore(
  db: Database,
  createId: () => string = () => crypto.randomUUID(),
): CaseActionStore {
  async function actorIdentity(tx: Transaction, actor: CaseActionActor) {
    const rows = await tx
      .select({ id: user.id, name: user.name })
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
  async function parent(
    tx: Transaction,
    actor: CaseActionActor,
    caseId: string,
  ) {
    const rows = await tx
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
  async function validAssignee(
    tx: Transaction,
    actor: CaseActionActor,
    caseId: string,
    userId: string | null,
  ) {
    if (!userId) return null;
    const rows = await tx
      .select({ id: user.id, name: user.name })
      .from(caseAssignments)
      .innerJoin(user, eq(user.id, caseAssignments.userId))
      .innerJoin(
        member,
        and(
          eq(member.organizationId, actor.organizationId),
          eq(member.userId, user.id),
        ),
      )
      .where(
        and(
          eq(caseAssignments.organizationId, actor.organizationId),
          eq(caseAssignments.caseId, caseId),
          eq(caseAssignments.userId, userId),
          eq(caseAssignments.responsibility, "member"),
          isNull(caseAssignments.endedAt),
        ),
      )
      .limit(1)
      .for("share");
    return rows[0] ?? undefined;
  }
  async function current(
    tx: Transaction,
    actor: CaseActionActor,
    caseId: string,
    actionId: string,
  ) {
    const rows = await tx
      .select()
      .from(caseActions)
      .where(
        and(
          eq(caseActions.organizationId, actor.organizationId),
          eq(caseActions.caseId, caseId),
          eq(caseActions.id, actionId),
        ),
      )
      .limit(1)
      .for("update");
    return rows[0] ?? null;
  }
  async function get(organizationId: string, caseId: string, actionId: string) {
    const rows = await joined(db)
      .where(
        and(
          eq(caseActions.organizationId, organizationId),
          eq(caseActions.caseId, caseId),
          eq(caseActions.id, actionId),
        ),
      )
      .limit(1);
    return rows[0] ? present(rows[0]) : null;
  }
  async function activity(
    tx: Transaction,
    actor: CaseActionActor,
    actorName: string,
    caseId: string,
    type: string,
    details: Record<string, string | null>,
    at: Date,
    subject?: { id: string; name: string } | null,
  ) {
    await tx.insert(caseActivities).values({
      id: createId(),
      organizationId: actor.organizationId,
      caseId,
      type,
      actorUserId: actor.userId,
      actorNameSnapshot: actorName,
      subjectUserId: subject?.id ?? null,
      subjectNameSnapshot: subject?.name ?? null,
      details,
      createdAt: at,
    });
  }
  const details = (action: {
    id: string;
    description: string;
    assigneeUserId: string | null;
    assigneeNameSnapshot: string | null;
  }) => ({
    actionId: action.id,
    description: action.description,
    assigneeUserId: action.assigneeUserId,
    assigneeName: action.assigneeNameSnapshot,
  });

  async function lifecycle(
    actor: CaseActionActor,
    caseId: string,
    actionId: string,
    expectedUpdatedAt: string,
    kind: "complete" | "reopen" | "archive" | "restore",
  ) {
    const result = await db.transaction(async (tx) => {
      const [actorRecord, caseRecord] = await Promise.all([
        actorIdentity(tx, actor),
        parent(tx, actor, caseId),
      ]);
      if (!actorRecord) return { status: "forbidden" as const };
      if (!caseRecord) return { status: "not_found" as const };
      if (caseRecord.archivedAt) return { status: "case_archived" as const };
      const action = await current(tx, actor, caseId, actionId);
      if (!action) return { status: "not_found" as const };
      if (action.updatedAt.toISOString() !== expectedUpdatedAt)
        return { status: "conflict" as const };
      if (kind !== "restore" && action.archivedAt)
        return kind === "archive"
          ? { status: "unchanged" as const }
          : { status: "conflict" as const };
      if (kind === "restore" && !action.archivedAt)
        return { status: "unchanged" as const };
      if (kind === "complete" && action.status === "completed")
        return { status: "unchanged" as const };
      if (kind === "reopen" && action.status === "pending")
        return { status: "unchanged" as const };
      const at = nextInstant(action.updatedAt);
      const values =
        kind === "complete"
          ? {
              status: "completed" as const,
              completedAt: at,
              completedByUserId: actor.userId,
              updatedAt: at,
            }
          : kind === "reopen"
            ? {
                status: "pending" as const,
                completedAt: null,
                completedByUserId: null,
                updatedAt: at,
              }
            : kind === "archive"
              ? {
                  archivedAt: at,
                  archivedByUserId: actor.userId,
                  updatedAt: at,
                }
              : { archivedAt: null, archivedByUserId: null, updatedAt: at };
      await tx
        .update(caseActions)
        .set(values)
        .where(eq(caseActions.id, actionId));
      await activity(
        tx,
        actor,
        actorRecord.name,
        caseId,
        `case.action_${kind === "complete" ? "completed" : kind === "reopen" ? "reopened" : kind === "archive" ? "archived" : "restored"}`,
        details(action),
        at,
      );
      return { status: "updated" as const };
    });
    if (result.status !== "updated" && result.status !== "unchanged")
      return result;
    return {
      status: result.status,
      action: (await get(actor.organizationId, caseId, actionId))!,
    };
  }

  return {
    async hasMembership(userId, organizationId) {
      return (
        (
          await db
            .select({ id: member.id })
            .from(member)
            .where(
              and(
                eq(member.userId, userId),
                eq(member.organizationId, organizationId),
              ),
            )
            .limit(1)
        ).length > 0
      );
    },
    async list(organizationId, caseId, input) {
      if (
        !(
          await db
            .select({ id: legalCases.id })
            .from(legalCases)
            .where(
              and(
                eq(legalCases.organizationId, organizationId),
                eq(legalCases.id, caseId),
              ),
            )
            .limit(1)
        )[0]
      )
        return null;
      const lifecycle =
        input.status === "archived"
          ? isNotNull(caseActions.archivedAt)
          : input.status === "active"
            ? isNull(caseActions.archivedAt)
            : and(
                isNull(caseActions.archivedAt),
                eq(caseActions.status, input.status),
              );
      const scope = and(
        eq(caseActions.organizationId, organizationId),
        eq(caseActions.caseId, caseId),
        lifecycle,
      );
      const order =
        input.status === "archived"
          ? desc(caseActions.archivedAt)
          : input.status === "completed"
            ? desc(caseActions.completedAt)
            : desc(caseActions.createdAt);
      const [rows, totals] = await Promise.all([
        joined(db)
          .where(scope)
          .orderBy(order, desc(caseActions.id))
          .limit(input.pageSize)
          .offset((input.page - 1) * input.pageSize),
        db.select({ value: count() }).from(caseActions).where(scope),
      ]);
      return { actions: rows.map(present), total: totals[0]?.value ?? 0 };
    },
    async create(actor, caseId, actionId, values) {
      const result = await db.transaction(async (tx) => {
        const [actorRecord, caseRecord] = await Promise.all([
          actorIdentity(tx, actor),
          parent(tx, actor, caseId),
        ]);
        if (!actorRecord) return { status: "forbidden" as const };
        if (!caseRecord) return { status: "not_found" as const };
        if (caseRecord.archivedAt) return { status: "case_archived" as const };
        const assignee = await validAssignee(
          tx,
          actor,
          caseId,
          values.assigneeUserId,
        );
        if (assignee === undefined)
          return { status: "assignee_not_found" as const };
        const at = new Date();
        await tx.insert(caseActions).values({
          id: actionId,
          organizationId: actor.organizationId,
          caseId,
          description: values.description,
          assigneeUserId: assignee?.id ?? null,
          assigneeNameSnapshot: assignee?.name ?? null,
          createdByUserId: actor.userId,
          createdAt: at,
          updatedAt: at,
        });
        await activity(
          tx,
          actor,
          actorRecord.name,
          caseId,
          "case.action_created",
          {
            actionId,
            description: values.description,
            assigneeUserId: assignee?.id ?? null,
            assigneeName: assignee?.name ?? null,
          },
          at,
          assignee,
        );
        return { status: "created" as const };
      });
      if (result.status !== "created") return result;
      return {
        status: "created",
        action: (await get(actor.organizationId, caseId, actionId))!,
      };
    },
    async update(actor, caseId, actionId, values, expectedUpdatedAt) {
      const result = await db.transaction(async (tx) => {
        const [actorRecord, caseRecord] = await Promise.all([
          actorIdentity(tx, actor),
          parent(tx, actor, caseId),
        ]);
        if (!actorRecord) return { status: "forbidden" as const };
        if (!caseRecord) return { status: "not_found" as const };
        if (caseRecord.archivedAt) return { status: "case_archived" as const };
        const action = await current(tx, actor, caseId, actionId);
        if (!action) return { status: "not_found" as const };
        if (
          action.updatedAt.toISOString() !== expectedUpdatedAt ||
          action.archivedAt
        )
          return { status: "conflict" as const };
        const assigneeChanged =
          Object.prototype.hasOwnProperty.call(values, "assigneeUserId") &&
          values.assigneeUserId !== action.assigneeUserId;
        const assignee = assigneeChanged
          ? await validAssignee(
              tx,
              actor,
              caseId,
              values.assigneeUserId ?? null,
            )
          : null;
        if (assignee === undefined)
          return { status: "assignee_not_found" as const };
        const nextDescription = values.description ?? action.description;
        if (!assigneeChanged && nextDescription === action.description)
          return { status: "unchanged" as const };
        const at = nextInstant(action.updatedAt);
        const set = {
          ...values,
          ...(assigneeChanged
            ? { assigneeNameSnapshot: assignee?.name ?? null }
            : {}),
          updatedAt: at,
        };
        await tx
          .update(caseActions)
          .set(set)
          .where(eq(caseActions.id, actionId));
        const activityDetails = {
          ...details(action),
          newDescription: nextDescription,
          newAssigneeUserId: assigneeChanged
            ? (assignee?.id ?? null)
            : action.assigneeUserId,
          newAssigneeName: assigneeChanged
            ? (assignee?.name ?? null)
            : action.assigneeNameSnapshot,
        };
        await activity(
          tx,
          actor,
          actorRecord.name,
          caseId,
          assigneeChanged ? "case.action_assigned" : "case.action_updated",
          activityDetails,
          at,
          assigneeChanged ? assignee : null,
        );
        return { status: "updated" as const };
      });
      if (result.status !== "updated" && result.status !== "unchanged")
        return result;
      return {
        status: result.status,
        action: (await get(actor.organizationId, caseId, actionId))!,
      };
    },
    complete: (actor, caseId, actionId, expected) =>
      lifecycle(actor, caseId, actionId, expected, "complete"),
    reopen: (actor, caseId, actionId, expected) =>
      lifecycle(actor, caseId, actionId, expected, "reopen"),
    archive: (actor, caseId, actionId, expected) =>
      lifecycle(actor, caseId, actionId, expected, "archive"),
    restore: (actor, caseId, actionId, expected) =>
      lifecycle(actor, caseId, actionId, expected, "restore"),
  };
}
