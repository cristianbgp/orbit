import { and, asc, eq, isNull, sql, type SQLWrapper } from "drizzle-orm";

import { member, user } from "../db/auth-schema";
import { client } from "../db/client-schema";
import { legalCases } from "../db/case-schema";
import type { createDatabase } from "../db/client";
import { accentInsensitiveMatchesAny } from "../db/search-text";
import { project } from "../db/project-schema";
import { projectStage } from "../db/project-stage-schema";
import { projectTask } from "../db/project-task-schema";
import type { SearchStore } from "./search-types";

type Database = ReturnType<typeof createDatabase>["db"];

function matchRank(columns: SQLWrapper[], query: string) {
  return sql<number>`case
    when ${accentInsensitiveMatchesAny(columns, query, "exact")} then 0
    when ${accentInsensitiveMatchesAny(columns, query, "prefix")} then 1
    else 2
  end`;
}

const effectiveUserAlias = sql<string>`coalesce(
  ${user.alias},
  public.orbit_generate_user_alias(${user.name})
)`;

export function createDrizzleSearchStore(db: Database): SearchStore {
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

    async search(scope, query, limit) {
      const caseColumns: SQLWrapper[] = [
        legalCases.identification,
        legalCases.docketNumber,
        client.name,
        legalCases.disputedMatter,
        legalCases.challengedResolution,
      ];
      const projectColumns: SQLWrapper[] = [
        project.name,
        client.name,
        project.internalReference,
      ];
      const taskColumns: SQLWrapper[] = [
        projectTask.title,
        project.name,
        client.name,
        projectStage.name,
      ];
      const clientColumns: SQLWrapper[] = [client.name, client.documentNumber];
      const memberColumns: SQLWrapper[] = [
        effectiveUserAlias,
        user.name,
        user.email,
      ];
      const [caseRows, projectRows, taskRows, clientRows, memberRows] =
        await Promise.all([
          db
            .select({
              id: legalCases.id,
              identification: legalCases.identification,
              status: legalCases.status,
              type: legalCases.type,
              clientId: client.id,
              clientName: client.name,
            })
            .from(legalCases)
            .innerJoin(
              client,
              and(
                eq(legalCases.clientId, client.id),
                eq(client.organizationId, scope.organizationId),
              ),
            )
            .where(
              and(
                eq(legalCases.organizationId, scope.organizationId),
                isNull(legalCases.archivedAt),
                accentInsensitiveMatchesAny(caseColumns, query),
              ),
            )
            .orderBy(
              matchRank(caseColumns, query),
              asc(legalCases.identification),
              asc(legalCases.id),
            )
            .limit(limit),
          db
            .select({
              id: project.id,
              name: project.name,
              status: project.status,
              clientId: client.id,
              clientName: client.name,
            })
            .from(project)
            .innerJoin(
              client,
              and(
                eq(project.clientId, client.id),
                eq(client.organizationId, scope.organizationId),
              ),
            )
            .where(
              and(
                eq(project.organizationId, scope.organizationId),
                isNull(project.archivedAt),
                accentInsensitiveMatchesAny(projectColumns, query),
              ),
            )
            .orderBy(
              matchRank(projectColumns, query),
              asc(project.name),
              asc(project.id),
            )
            .limit(limit),
          db
            .select({
              id: projectTask.id,
              title: projectTask.title,
              status: projectTask.status,
              projectId: project.id,
              projectName: project.name,
              clientId: client.id,
              clientName: client.name,
              stageId: projectStage.id,
              stageName: projectStage.name,
            })
            .from(projectTask)
            .innerJoin(project, eq(projectTask.projectId, project.id))
            .innerJoin(
              client,
              and(
                eq(project.clientId, client.id),
                eq(client.organizationId, scope.organizationId),
              ),
            )
            .innerJoin(
              projectStage,
              and(
                eq(projectTask.stageId, projectStage.id),
                eq(projectStage.organizationId, scope.organizationId),
                eq(projectStage.projectId, project.id),
              ),
            )
            .where(
              and(
                eq(projectTask.organizationId, scope.organizationId),
                eq(project.organizationId, scope.organizationId),
                isNull(projectTask.archivedAt),
                isNull(project.archivedAt),
                accentInsensitiveMatchesAny(taskColumns, query),
              ),
            )
            .orderBy(
              matchRank(taskColumns, query),
              asc(projectTask.title),
              asc(projectTask.id),
            )
            .limit(limit),
          db
            .select({
              id: client.id,
              name: client.name,
              type: client.type,
              documentNumber: client.documentNumber,
            })
            .from(client)
            .where(
              and(
                eq(client.organizationId, scope.organizationId),
                accentInsensitiveMatchesAny(clientColumns, query),
              ),
            )
            .orderBy(
              matchRank(clientColumns, query),
              asc(client.name),
              asc(client.id),
            )
            .limit(limit),
          db
            .select({
              userId: user.id,
              alias: effectiveUserAlias,
              avatarColor: user.avatarColor,
              name: user.name,
              email: user.email,
              role: member.role,
            })
            .from(member)
            .innerJoin(user, eq(member.userId, user.id))
            .where(
              and(
                eq(member.organizationId, scope.organizationId),
                accentInsensitiveMatchesAny(memberColumns, query),
              ),
            )
            .orderBy(
              matchRank(memberColumns, query),
              asc(effectiveUserAlias),
              asc(user.id),
            )
            .limit(limit),
        ]);

      return {
        cases: caseRows.map((row) => ({
          id: row.id,
          identification: row.identification,
          status: row.status,
          type: row.type,
          client: { id: row.clientId, name: row.clientName },
        })),
        projects: projectRows.map((row) => ({
          id: row.id,
          name: row.name,
          status: row.status,
          client: { id: row.clientId, name: row.clientName },
        })),
        tasks: taskRows.map((row) => ({
          id: row.id,
          title: row.title,
          status: row.status,
          project: { id: row.projectId, name: row.projectName },
          client: { id: row.clientId, name: row.clientName },
          stage: { id: row.stageId, name: row.stageName },
        })),
        clients: clientRows,
        members: memberRows,
      };
    },
  };
}
