import { and, desc, eq, inArray, lt, or } from "drizzle-orm";

import type { createDatabase } from "../db/client";
import { member, organization, user } from "../db/auth-schema";
import { projectActivity } from "../db/project-collaboration-schema";
import { project } from "../db/project-schema";
import { caseActivities, legalCases } from "../db/case-schema";
import { resolveUserAlias } from "../identity/user-alias";
import type { ProjectActivityIdentityRecord } from "../project-collaboration/project-collaboration-types";
import type { DashboardStore } from "./dashboard-service";

type Database = ReturnType<typeof createDatabase>["db"];

const activitySelection = {
  id: projectActivity.id,
  organizationId: projectActivity.organizationId,
  projectId: projectActivity.projectId,
  projectName: project.name,
  projectStatus: project.status,
  projectArchivedAt: project.archivedAt,
  type: projectActivity.type,
  actorUserId: projectActivity.actorUserId,
  actorNameSnapshot: projectActivity.actorNameSnapshot,
  subjectUserId: projectActivity.subjectUserId,
  subjectNameSnapshot: projectActivity.subjectNameSnapshot,
  details: projectActivity.details,
  createdAt: projectActivity.createdAt,
};

function identity(
  userId: string | null,
  nameSnapshot: string,
  current:
    { alias: string | null; avatarColor: string; name: string } | undefined,
): ProjectActivityIdentityRecord {
  return {
    userId,
    alias: current ? resolveUserAlias(current.alias, current.name) : null,
    avatarColor: current?.avatarColor ?? null,
    nameSnapshot,
    activeStudioMember: current !== undefined,
    linkable: userId !== null && current !== undefined,
  };
}

export function createDrizzleDashboardStore(db: Database): DashboardStore {
  return {
    async findMemberContext(userId, organizationId) {
      const rows = await db
        .select({ timeZone: organization.timeZone })
        .from(member)
        .innerJoin(organization, eq(member.organizationId, organization.id))
        .where(
          and(
            eq(member.userId, userId),
            eq(member.organizationId, organizationId),
          ),
        )
        .limit(1);
      return rows[0] ?? null;
    },

    async listActivity(organizationId, { limit, cursor }) {
      const projectCursorScope = cursor
        ? or(
            lt(projectActivity.createdAt, cursor.createdAt),
            and(
              eq(projectActivity.createdAt, cursor.createdAt),
              lt(projectActivity.id, cursor.id),
            ),
          )
        : undefined;
      const projectRows = await db
        .select(activitySelection)
        .from(projectActivity)
        .innerJoin(
          project,
          and(
            eq(projectActivity.projectId, project.id),
            eq(projectActivity.organizationId, project.organizationId),
          ),
        )
        .where(
          and(
            eq(projectActivity.organizationId, organizationId),
            projectCursorScope,
          ),
        )
        .orderBy(desc(projectActivity.createdAt), desc(projectActivity.id))
        .limit(limit + 1);
      const caseCursorScope = cursor
        ? or(
            lt(caseActivities.createdAt, cursor.createdAt),
            and(
              eq(caseActivities.createdAt, cursor.createdAt),
              lt(caseActivities.id, cursor.id),
            ),
          )
        : undefined;
      const caseRows = await db
        .select({
          id: caseActivities.id,
          organizationId: caseActivities.organizationId,
          caseId: caseActivities.caseId,
          caseIdentification: legalCases.identification,
          caseStatus: legalCases.status,
          caseArchivedAt: legalCases.archivedAt,
          type: caseActivities.type,
          actorUserId: caseActivities.actorUserId,
          actorNameSnapshot: caseActivities.actorNameSnapshot,
          subjectUserId: caseActivities.subjectUserId,
          subjectNameSnapshot: caseActivities.subjectNameSnapshot,
          details: caseActivities.details,
          createdAt: caseActivities.createdAt,
        })
        .from(caseActivities)
        .innerJoin(
          legalCases,
          and(
            eq(caseActivities.caseId, legalCases.id),
            eq(caseActivities.organizationId, legalCases.organizationId),
          ),
        )
        .where(
          and(
            eq(caseActivities.organizationId, organizationId),
            caseCursorScope,
          ),
        )
        .orderBy(desc(caseActivities.createdAt), desc(caseActivities.id))
        .limit(limit + 1);
      const mergedRows = [
        ...projectRows.map((row) => ({ ...row, source: "project" as const })),
        ...caseRows.map((row) => ({ ...row, source: "case" as const })),
      ].sort(
        (left, right) =>
          right.createdAt.getTime() - left.createdAt.getTime() ||
          right.id.localeCompare(left.id),
      );
      const hasMore = mergedRows.length > limit;
      const pageRows = mergedRows.slice(0, limit);
      const identityUserIds = [
        ...new Set(
          pageRows.flatMap(({ actorUserId, subjectUserId }) =>
            [actorUserId, subjectUserId].filter(
              (value): value is string => value !== null,
            ),
          ),
        ),
      ];
      const currentIdentities =
        identityUserIds.length === 0
          ? []
          : await db
              .select({
                userId: member.userId,
                alias: user.alias,
                avatarColor: user.avatarColor,
                name: user.name,
              })
              .from(member)
              .innerJoin(user, eq(member.userId, user.id))
              .where(
                and(
                  eq(member.organizationId, organizationId),
                  inArray(member.userId, identityUserIds),
                ),
              );
      const currentIdentityByUserId = new Map(
        currentIdentities.map((current) => [current.userId, current]),
      );

      return {
        hasMore,
        activities: pageRows.map((activity) => {
          const common = {
            id: activity.id,
            organizationId: activity.organizationId,
            type: activity.type,
            actor: identity(
              activity.actorUserId,
              activity.actorNameSnapshot,
              activity.actorUserId === null
                ? undefined
                : currentIdentityByUserId.get(activity.actorUserId),
            ),
            subject:
              activity.subjectNameSnapshot === null
                ? null
                : identity(
                    activity.subjectUserId,
                    activity.subjectNameSnapshot,
                    activity.subjectUserId === null
                      ? undefined
                      : currentIdentityByUserId.get(activity.subjectUserId),
                  ),
            details: activity.details,
            createdAt: activity.createdAt,
          };
          return activity.source === "project"
            ? {
                ...common,
                source: "project" as const,
                projectId: activity.projectId,
                project: {
                  id: activity.projectId,
                  name: activity.projectName,
                  status: activity.projectStatus,
                  archivedAt: activity.projectArchivedAt,
                },
                case: null,
              }
            : {
                ...common,
                source: "case" as const,
                projectId: null,
                project: null,
                case: {
                  id: activity.caseId,
                  identification: activity.caseIdentification,
                  status: activity.caseStatus,
                  archivedAt: activity.caseArchivedAt,
                },
              };
        }),
      };
    },
  };
}
