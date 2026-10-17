import {
  and,
  asc,
  count,
  eq,
  exists,
  gte,
  inArray,
  isNull,
  lte,
} from "drizzle-orm";

import { member, user } from "../db/auth-schema";
import { caseEvents } from "../db/case-event-schema";
import { client } from "../db/client-schema";
import { caseActivities, caseAssignments, legalCases } from "../db/case-schema";
import type { createDatabase } from "../db/client";
import { accentInsensitiveMatchesAny } from "../db/search-text";
import type { CaseEventStore } from "./case-event-service";
import type {
  CaseEventActor,
  CaseEventCalendarItem,
  CaseEventRecord,
} from "./case-event-types";

type Database = ReturnType<typeof createDatabase>["db"];
type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];

const eventSelection = {
  id: caseEvents.id,
  organizationId: caseEvents.organizationId,
  caseId: caseEvents.caseId,
  title: caseEvents.title,
  type: caseEvents.type,
  date: caseEvents.date,
  description: caseEvents.description,
  createdByUserId: caseEvents.createdByUserId,
  createdAt: caseEvents.createdAt,
  updatedAt: caseEvents.updatedAt,
};

function activityDetails(event: CaseEventRecord) {
  return {
    eventId: event.id,
    title: event.title,
    type: event.type,
    date: event.date,
    description: event.description,
  };
}

function versionMatches(updatedAt: Date, expectedUpdatedAt: string) {
  return updatedAt.toISOString() === expectedUpdatedAt;
}

export function createDrizzleCaseEventStore(
  db: Database,
  createId: () => string = () => crypto.randomUUID(),
): CaseEventStore {
  async function actorIdentity(
    transaction: Transaction,
    actor: CaseEventActor,
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
    actor: CaseEventActor,
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

  async function addActivity(
    transaction: Transaction,
    actor: CaseEventActor,
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

  async function currentEvent(
    transaction: Transaction,
    actor: CaseEventActor,
    caseId: string,
    eventId: string,
  ) {
    const rows = await transaction
      .select(eventSelection)
      .from(caseEvents)
      .where(
        and(
          eq(caseEvents.organizationId, actor.organizationId),
          eq(caseEvents.caseId, caseId),
          eq(caseEvents.id, eventId),
        ),
      )
      .limit(1)
      .for("update");
    return rows[0] ?? null;
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

    async calendar(organizationId, filters) {
      const search = filters.search
        ? accentInsensitiveMatchesAny(
            [
              caseEvents.title,
              caseEvents.description,
              legalCases.identification,
              legalCases.docketNumber,
              client.name,
              legalCases.disputedMatter,
            ],
            filters.search,
          )
        : undefined;
      const rows = await db
        .select({
          ...eventSelection,
          contextCaseId: legalCases.id,
          contextIdentification: legalCases.identification,
          contextStatus: legalCases.status,
          contextType: legalCases.type,
          contextStage: legalCases.stage,
          contextDocketNumber: legalCases.docketNumber,
          contextClientId: client.id,
          contextClientName: client.name,
        })
        .from(caseEvents)
        .innerJoin(
          legalCases,
          and(
            eq(legalCases.id, caseEvents.caseId),
            eq(legalCases.organizationId, caseEvents.organizationId),
          ),
        )
        .innerJoin(
          client,
          and(
            eq(client.id, legalCases.clientId),
            eq(client.organizationId, legalCases.organizationId),
          ),
        )
        .where(
          and(
            eq(caseEvents.organizationId, organizationId),
            gte(caseEvents.date, filters.from),
            lte(caseEvents.date, filters.to),
            eq(legalCases.status, filters.caseStatus),
            isNull(legalCases.archivedAt),
            search,
            filters.types.length
              ? inArray(legalCases.type, filters.types)
              : undefined,
            filters.clientIds.length
              ? inArray(legalCases.clientId, filters.clientIds)
              : undefined,
            ...filters.memberUserIds.map((userId) =>
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
          ),
        )
        .orderBy(
          asc(caseEvents.date),
          asc(legalCases.identification),
          asc(caseEvents.title),
          asc(caseEvents.id),
        )
        .limit(filters.limit);
      return rows.map(
        ({
          contextCaseId,
          contextIdentification,
          contextStatus,
          contextType,
          contextStage,
          contextDocketNumber,
          contextClientId,
          contextClientName,
          ...event
        }) => ({
          ...event,
          case: {
            id: contextCaseId,
            identification: contextIdentification,
            status: contextStatus,
            type: contextType,
            stage: contextStage,
            docketNumber: contextDocketNumber,
            client: { id: contextClientId, name: contextClientName },
          },
        }),
      ) as CaseEventCalendarItem[];
    },

    async list(organizationId, caseId, pagination) {
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

      const scope = and(
        eq(caseEvents.organizationId, organizationId),
        eq(caseEvents.caseId, caseId),
      );
      const [events, totals] = await Promise.all([
        db
          .select(eventSelection)
          .from(caseEvents)
          .where(scope)
          .orderBy(asc(caseEvents.date), asc(caseEvents.id))
          .limit(pagination.pageSize)
          .offset((pagination.page - 1) * pagination.pageSize),
        db.select({ value: count() }).from(caseEvents).where(scope),
      ]);
      return { events, total: totals[0]?.value ?? 0 };
    },

    async create(actor, caseId, eventId, values) {
      return db.transaction(async (transaction) => {
        const identity = await actorIdentity(transaction, actor);
        if (!identity) return { status: "forbidden" as const };
        const caseRecord = await parentCase(transaction, actor, caseId);
        if (!caseRecord) return { status: "not_found" as const };
        if (caseRecord.archivedAt) {
          return { status: "case_archived" as const };
        }

        const createdAt = new Date();
        await transaction.insert(caseEvents).values({
          id: eventId,
          organizationId: actor.organizationId,
          caseId,
          ...values,
          createdByUserId: identity.userId,
          createdAt,
          updatedAt: createdAt,
        });
        const event: CaseEventRecord = {
          id: eventId,
          organizationId: actor.organizationId,
          caseId,
          ...values,
          createdByUserId: identity.userId,
          createdAt,
          updatedAt: createdAt,
        };
        await addActivity(
          transaction,
          actor,
          identity.name,
          caseId,
          "case.event_created",
          activityDetails(event),
          createdAt,
        );
        return { status: "created" as const, event };
      });
    },

    async update(actor, caseId, eventId, values, expectedUpdatedAt) {
      return db.transaction(async (transaction) => {
        const identity = await actorIdentity(transaction, actor);
        if (!identity) return { status: "forbidden" as const };
        const caseRecord = await parentCase(transaction, actor, caseId);
        if (!caseRecord) return { status: "not_found" as const };
        if (caseRecord.archivedAt) {
          return { status: "case_archived" as const };
        }
        const current = await currentEvent(transaction, actor, caseId, eventId);
        if (!current) return { status: "not_found" as const };
        if (!versionMatches(current.updatedAt, expectedUpdatedAt)) {
          return { status: "conflict" as const };
        }

        const next = { ...current, ...values };
        if (
          next.title === current.title &&
          next.type === current.type &&
          next.date === current.date &&
          next.description === current.description
        ) {
          return { status: "unchanged" as const, event: current };
        }

        const updatedAt = new Date();
        await transaction
          .update(caseEvents)
          .set({ ...values, updatedAt })
          .where(
            and(
              eq(caseEvents.organizationId, actor.organizationId),
              eq(caseEvents.caseId, caseId),
              eq(caseEvents.id, eventId),
            ),
          );
        const event = { ...next, updatedAt };
        await addActivity(
          transaction,
          actor,
          identity.name,
          caseId,
          "case.event_updated",
          {
            ...activityDetails(current),
            newTitle: event.title,
            newType: event.type,
            newDate: event.date,
            newDescription: event.description,
          },
          updatedAt,
        );
        return { status: "updated" as const, event };
      });
    },

    async remove(actor, caseId, eventId, expectedUpdatedAt) {
      return db.transaction(async (transaction) => {
        const identity = await actorIdentity(transaction, actor);
        if (!identity) return { status: "forbidden" as const };
        const caseRecord = await parentCase(transaction, actor, caseId);
        if (!caseRecord) return { status: "not_found" as const };
        if (caseRecord.archivedAt) {
          return { status: "case_archived" as const };
        }
        const current = await currentEvent(transaction, actor, caseId, eventId);
        if (!current) return { status: "not_found" as const };
        if (!versionMatches(current.updatedAt, expectedUpdatedAt)) {
          return { status: "conflict" as const };
        }

        await transaction
          .delete(caseEvents)
          .where(
            and(
              eq(caseEvents.organizationId, actor.organizationId),
              eq(caseEvents.caseId, caseId),
              eq(caseEvents.id, eventId),
            ),
          );
        await addActivity(
          transaction,
          actor,
          identity.name,
          caseId,
          "case.event_deleted",
          activityDetails(current),
          new Date(),
        );
        return { status: "removed" as const };
      });
    },
  };
}
