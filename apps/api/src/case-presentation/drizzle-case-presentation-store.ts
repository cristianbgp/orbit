import {
  and,
  asc,
  desc,
  eq,
  exists,
  gte,
  inArray,
  isNull,
  lt,
} from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import { member, organization, user } from "../db/auth-schema";
import { caseActions } from "../db/case-action-schema";
import { caseEvents } from "../db/case-event-schema";
import { caseAssignments, legalCases } from "../db/case-schema";
import { caseUpdates } from "../db/case-update-schema";
import { client } from "../db/client-schema";
import type { createDatabase } from "../db/client";
import { isStudioMemberPosition } from "../identity/studio-member-position";
import { resolveUserAlias } from "../identity/user-alias";
import type { CaseActionIdentity } from "../case-actions/case-action-types";
import type { CasePresentationStore } from "./case-presentation-service";
import type {
  CasePresentationCase,
  CasePresentationClient,
  CasePresentationTruncationScope,
} from "./case-presentation-types";

type Database = ReturnType<typeof createDatabase>["db"];

const CASE_LIMIT = 200;
const CHILD_LIMIT = 5_000;
const spanishCollator = new Intl.Collator("es", { sensitivity: "base" });

const updateCreator = alias(user, "presentation_update_creator");
const updateCreatorMember = alias(member, "presentation_update_creator_member");
const actionAssignee = alias(user, "presentation_action_assignee");
const actionAssigneeMember = alias(
  member,
  "presentation_action_assignee_member",
);
const actionCreator = alias(user, "presentation_action_creator");
const actionCreatorMember = alias(member, "presentation_action_creator_member");

function dateInTimeZone(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return `${value("year")}-${value("month")}-${value("day")}`;
}

function append<T>(map: Map<string, T[]>, key: string, value: T) {
  map.set(key, [...(map.get(key) ?? []), value]);
}

function actionIdentity(values: {
  userId: string | null;
  name: string | null;
  snapshot?: string | null;
  alias: string | null;
  avatarColor: string | null;
  studioMemberId: string | null;
  activeCaseMember: boolean;
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
    activeCaseMember: values.activeCaseMember,
    linkable: values.userId !== null && activeStudioMember,
  };
}

export function createDrizzleCasePresentationStore(
  db: Database,
  options: { now?: () => Date } = {},
): CasePresentationStore {
  const now = options.now ?? (() => new Date());

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

    async list(organizationId, filters) {
      const organizationRows = await db
        .select({ timeZone: organization.timeZone })
        .from(organization)
        .where(eq(organization.id, organizationId))
        .limit(1);
      const organizationDate = dateInTimeZone(
        now(),
        organizationRows[0]?.timeZone ?? "America/Lima",
      );

      const caseRows = await db
        .select({
          id: legalCases.id,
          clientId: client.id,
          clientName: client.name,
          identification: legalCases.identification,
          status: legalCases.status,
          result: legalCases.result,
          type: legalCases.type,
          stage: legalCases.stage,
          docketNumber: legalCases.docketNumber,
          periodKind: legalCases.periodKind,
          periodStart: legalCases.periodStart,
          periodEnd: legalCases.periodEnd,
        })
        .from(legalCases)
        .innerJoin(
          client,
          and(
            eq(client.id, legalCases.clientId),
            eq(client.organizationId, legalCases.organizationId),
          ),
        )
        .where(
          and(
            eq(legalCases.organizationId, organizationId),
            isNull(legalCases.archivedAt),
            inArray(legalCases.status, filters.statuses),
            filters.clientIds.length
              ? inArray(legalCases.clientId, filters.clientIds)
              : undefined,
            filters.types.length
              ? inArray(legalCases.type, filters.types)
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
        .limit(CASE_LIMIT + 1);

      const truncatedScopes: CasePresentationTruncationScope[] = [];
      if (caseRows.length > CASE_LIMIT) truncatedScopes.push("cases");
      const selectedCases = caseRows.slice(0, CASE_LIMIT);
      const caseIds = selectedCases.map((entry) => entry.id);

      if (!caseIds.length) {
        return {
          generatedAt: now(),
          organizationDate,
          clients: [],
          truncated: {
            value: truncatedScopes.length > 0,
            scopes: truncatedScopes,
          },
        };
      }

      const [
        assignmentRows,
        updateRows,
        backgroundRows,
        actionRows,
        futureEventRows,
        pastEventRows,
      ] = await Promise.all([
        db
          .select({
            assignmentId: caseAssignments.id,
            caseId: caseAssignments.caseId,
            userId: caseAssignments.userId,
            snapshotName: caseAssignments.userNameSnapshot,
            currentName: user.name,
            alias: user.alias,
            avatarColor: user.avatarColor,
            studioMemberId: member.id,
            position: member.position,
            responsibility: caseAssignments.responsibility,
          })
          .from(caseAssignments)
          .leftJoin(user, eq(user.id, caseAssignments.userId))
          .leftJoin(
            member,
            and(
              eq(member.organizationId, caseAssignments.organizationId),
              eq(member.userId, caseAssignments.userId),
            ),
          )
          .where(
            and(
              eq(caseAssignments.organizationId, organizationId),
              inArray(caseAssignments.caseId, caseIds),
              isNull(caseAssignments.endedAt),
            ),
          )
          .limit(CHILD_LIMIT + 1),
        db
          .select({
            id: caseUpdates.id,
            organizationId: caseUpdates.organizationId,
            caseId: caseUpdates.caseId,
            date: caseUpdates.date,
            description: caseUpdates.description,
            kind: caseUpdates.kind,
            createdByUserId: caseUpdates.createdByUserId,
            creatorName: updateCreator.name,
            creatorAlias: updateCreator.alias,
            creatorAvatarColor: updateCreator.avatarColor,
            creatorMemberId: updateCreatorMember.id,
            createdAt: caseUpdates.createdAt,
            updatedAt: caseUpdates.updatedAt,
            archivedAt: caseUpdates.archivedAt,
          })
          .from(caseUpdates)
          .leftJoin(
            updateCreator,
            eq(updateCreator.id, caseUpdates.createdByUserId),
          )
          .leftJoin(
            updateCreatorMember,
            and(
              eq(
                updateCreatorMember.organizationId,
                caseUpdates.organizationId,
              ),
              eq(updateCreatorMember.userId, caseUpdates.createdByUserId),
            ),
          )
          .where(
            and(
              eq(caseUpdates.organizationId, organizationId),
              inArray(caseUpdates.caseId, caseIds),
              eq(caseUpdates.kind, "update"),
              isNull(caseUpdates.archivedAt),
            ),
          )
          .orderBy(
            desc(caseUpdates.date),
            desc(caseUpdates.createdAt),
            desc(caseUpdates.id),
          )
          .limit(CHILD_LIMIT + 1),
        db
          .select({
            id: caseUpdates.id,
            organizationId: caseUpdates.organizationId,
            caseId: caseUpdates.caseId,
            date: caseUpdates.date,
            description: caseUpdates.description,
            kind: caseUpdates.kind,
            createdByUserId: caseUpdates.createdByUserId,
            creatorName: updateCreator.name,
            creatorAlias: updateCreator.alias,
            creatorAvatarColor: updateCreator.avatarColor,
            creatorMemberId: updateCreatorMember.id,
            createdAt: caseUpdates.createdAt,
            updatedAt: caseUpdates.updatedAt,
            archivedAt: caseUpdates.archivedAt,
          })
          .from(caseUpdates)
          .leftJoin(
            updateCreator,
            eq(updateCreator.id, caseUpdates.createdByUserId),
          )
          .leftJoin(
            updateCreatorMember,
            and(
              eq(
                updateCreatorMember.organizationId,
                caseUpdates.organizationId,
              ),
              eq(updateCreatorMember.userId, caseUpdates.createdByUserId),
            ),
          )
          .where(
            and(
              eq(caseUpdates.organizationId, organizationId),
              inArray(caseUpdates.caseId, caseIds),
              eq(caseUpdates.kind, "background"),
              isNull(caseUpdates.archivedAt),
            ),
          )
          .orderBy(
            desc(caseUpdates.date),
            desc(caseUpdates.createdAt),
            desc(caseUpdates.id),
          )
          .limit(CHILD_LIMIT + 1),
        db
          .select({
            id: caseActions.id,
            organizationId: caseActions.organizationId,
            caseId: caseActions.caseId,
            description: caseActions.description,
            status: caseActions.status,
            assigneeUserId: caseActions.assigneeUserId,
            assigneeNameSnapshot: caseActions.assigneeNameSnapshot,
            assigneeName: actionAssignee.name,
            assigneeAlias: actionAssignee.alias,
            assigneeAvatarColor: actionAssignee.avatarColor,
            assigneeMemberId: actionAssigneeMember.id,
            creatorUserId: caseActions.createdByUserId,
            creatorName: actionCreator.name,
            creatorAlias: actionCreator.alias,
            creatorAvatarColor: actionCreator.avatarColor,
            creatorMemberId: actionCreatorMember.id,
            completedAt: caseActions.completedAt,
            completedByUserId: caseActions.completedByUserId,
            createdAt: caseActions.createdAt,
            updatedAt: caseActions.updatedAt,
            archivedAt: caseActions.archivedAt,
          })
          .from(caseActions)
          .leftJoin(
            actionAssignee,
            eq(actionAssignee.id, caseActions.assigneeUserId),
          )
          .leftJoin(
            actionAssigneeMember,
            and(
              eq(
                actionAssigneeMember.organizationId,
                caseActions.organizationId,
              ),
              eq(actionAssigneeMember.userId, caseActions.assigneeUserId),
            ),
          )
          .leftJoin(
            actionCreator,
            eq(actionCreator.id, caseActions.createdByUserId),
          )
          .leftJoin(
            actionCreatorMember,
            and(
              eq(
                actionCreatorMember.organizationId,
                caseActions.organizationId,
              ),
              eq(actionCreatorMember.userId, caseActions.createdByUserId),
            ),
          )
          .where(
            and(
              eq(caseActions.organizationId, organizationId),
              inArray(caseActions.caseId, caseIds),
              isNull(caseActions.archivedAt),
              filters.includeCompletedActions
                ? undefined
                : eq(caseActions.status, "pending"),
            ),
          )
          .orderBy(desc(caseActions.createdAt), desc(caseActions.id))
          .limit(CHILD_LIMIT + 1),
        db
          .select()
          .from(caseEvents)
          .where(
            and(
              eq(caseEvents.organizationId, organizationId),
              inArray(caseEvents.caseId, caseIds),
              gte(caseEvents.date, organizationDate),
            ),
          )
          .orderBy(
            asc(caseEvents.date),
            asc(caseEvents.title),
            asc(caseEvents.id),
          )
          .limit(CHILD_LIMIT + 1),
        filters.includePastEvents
          ? db
              .select()
              .from(caseEvents)
              .where(
                and(
                  eq(caseEvents.organizationId, organizationId),
                  inArray(caseEvents.caseId, caseIds),
                  lt(caseEvents.date, organizationDate),
                ),
              )
              .orderBy(
                desc(caseEvents.date),
                asc(caseEvents.title),
                asc(caseEvents.id),
              )
              .limit(CHILD_LIMIT + 1)
          : Promise.resolve([]),
      ]);

      const bounded = <T>(
        values: T[],
        scope: CasePresentationTruncationScope,
      ) => {
        if (values.length > CHILD_LIMIT) truncatedScopes.push(scope);
        return values.slice(0, CHILD_LIMIT);
      };
      const assignments = bounded(assignmentRows, "cases");
      const updates = bounded(updateRows, "updates");
      const backgrounds = bounded(backgroundRows, "updates");
      const actions = bounded(actionRows, "actions");
      const futureEvents = bounded(futureEventRows, "events");
      const pastEvents = bounded(pastEventRows, "events");

      const assignmentsByCase = new Map<string, typeof assignments>();
      const activeCaseUsers = new Map<string, Set<string>>();
      for (const row of assignments) {
        append(assignmentsByCase, row.caseId, row);
        if (row.userId && row.responsibility === "member") {
          const values = activeCaseUsers.get(row.caseId) ?? new Set<string>();
          values.add(row.userId);
          activeCaseUsers.set(row.caseId, values);
        }
      }

      const updatesByCase = new Map<string, CasePresentationCase["updates"]>();
      const backgroundsByCase = new Map<
        string,
        CasePresentationCase["backgrounds"]
      >();
      for (const [rows, destination] of [
        [updates, updatesByCase],
        [backgrounds, backgroundsByCase],
      ] as const) {
        for (const row of rows) {
          const fullName = row.creatorName ?? "Usuario no disponible";
          append(destination, row.caseId, {
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
              activeStudioMember: row.creatorMemberId !== null,
              linkable:
                row.createdByUserId !== null && row.creatorMemberId !== null,
            },
            createdAt: row.createdAt,
            updatedAt: row.updatedAt,
            archivedAt: row.archivedAt,
          });
        }
      }

      const actionsByCase = new Map<string, CasePresentationCase["actions"]>();
      for (const row of actions) {
        const caseUsers = activeCaseUsers.get(row.caseId) ?? new Set<string>();
        append(actionsByCase, row.caseId, {
          id: row.id,
          organizationId: row.organizationId,
          caseId: row.caseId,
          description: row.description,
          status: row.status,
          assignee: actionIdentity({
            userId: row.assigneeUserId,
            name: row.assigneeName,
            snapshot: row.assigneeNameSnapshot,
            alias: row.assigneeAlias,
            avatarColor: row.assigneeAvatarColor,
            studioMemberId: row.assigneeMemberId,
            activeCaseMember:
              row.assigneeUserId !== null && caseUsers.has(row.assigneeUserId),
          }),
          creator: actionIdentity({
            userId: row.creatorUserId,
            name: row.creatorName,
            alias: row.creatorAlias,
            avatarColor: row.creatorAvatarColor,
            studioMemberId: row.creatorMemberId,
            activeCaseMember:
              row.creatorUserId !== null && caseUsers.has(row.creatorUserId),
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
        });
      }

      const eventsByCase = new Map<string, CasePresentationCase["events"]>();
      for (const row of [...futureEvents, ...pastEvents]) {
        append(eventsByCase, row.caseId, row);
      }

      const presentationCases = selectedCases.map((row) => {
        const people = (responsibility: "member" | "follower") =>
          (assignmentsByCase.get(row.id) ?? [])
            .filter((entry) => entry.responsibility === responsibility)
            .map((entry) => {
              const fullName = entry.currentName ?? entry.snapshotName;
              return {
                assignmentId: entry.assignmentId,
                userId: entry.userId,
                fullName,
                alias: entry.currentName
                  ? resolveUserAlias(entry.alias, entry.currentName)
                  : resolveUserAlias(null, entry.snapshotName),
                avatarColor: entry.avatarColor,
                position: isStudioMemberPosition(entry.position)
                  ? entry.position
                  : null,
                activeStudioMember: entry.studioMemberId !== null,
              };
            })
            .sort((left, right) =>
              spanishCollator.compare(left.fullName, right.fullName),
            );
        const team = people("member");
        const followers = people("follower");
        return {
          clientId: row.clientId,
          clientName: row.clientName,
          case: {
            id: row.id,
            identification: row.identification,
            status: row.status,
            result: row.result,
            type: row.type,
            stage: row.stage as CasePresentationCase["stage"],
            docketNumber: row.docketNumber,
            periodKind: row.periodKind,
            periodStart: row.periodStart,
            periodEnd: row.periodEnd,
            team,
            followers,
            updates: updatesByCase.get(row.id) ?? [],
            backgrounds: backgroundsByCase.get(row.id) ?? [],
            actions: actionsByCase.get(row.id) ?? [],
            events: eventsByCase.get(row.id) ?? [],
          } satisfies CasePresentationCase,
        };
      });

      const clientsById = new Map<string, CasePresentationClient>();
      for (const entry of presentationCases) {
        const group = clientsById.get(entry.clientId) ?? {
          id: entry.clientId,
          name: entry.clientName,
          cases: [],
        };
        group.cases.push(entry.case);
        clientsById.set(entry.clientId, group);
      }
      const clients = [...clientsById.values()]
        .map((entry) => ({
          ...entry,
          cases: entry.cases.sort((left, right) =>
            spanishCollator.compare(left.identification, right.identification),
          ),
        }))
        .sort((left, right) => spanishCollator.compare(left.name, right.name));

      return {
        generatedAt: now(),
        organizationDate,
        clients,
        truncated: {
          value: truncatedScopes.length > 0,
          scopes: [...new Set(truncatedScopes)],
        },
      };
    },
  };
}
