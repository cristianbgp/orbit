import {
  and,
  asc,
  count,
  desc,
  eq,
  exists,
  gte,
  inArray,
  isNull,
  lte,
  ne,
  or,
  sql,
} from "drizzle-orm";

import { member, organization, user } from "../db/auth-schema";
import { client } from "../db/client-schema";
import type { createDatabase } from "../db/client";
import {
  accentInsensitiveLike,
  accentInsensitiveMatchesAny,
} from "../db/search-text";
import { projectAssignment } from "../db/project-collaboration-schema";
import { project } from "../db/project-schema";
import { projectStage } from "../db/project-stage-schema";
import { projectTask, taskAssignment } from "../db/project-task-schema";
import { caseActions } from "../db/case-action-schema";
import { caseAssignments, legalCases } from "../db/case-schema";
import { resolveUserAlias } from "../identity/user-alias";
import { isStudioMemberPosition } from "../identity/studio-member-position";
import type { TaskResponsibleRecord } from "../project-tasks/project-task-types";
import type { MyWorkStore } from "./my-work-service";
import type {
  MyWorkFilters,
  MyWorkTask,
  MyWorkTaskGroup,
} from "./my-work-types";

type Database = ReturnType<typeof createDatabase>["db"];

const taskSelection = {
  id: projectTask.id,
  title: projectTask.title,
  status: projectTask.status,
  plannedStartDate: projectTask.plannedStartDate,
  internalDueDate: projectTask.internalDueDate,
  updatedAt: projectTask.updatedAt,
  projectId: project.id,
  projectName: project.name,
  clientId: client.id,
  clientName: client.name,
  stageId: projectStage.id,
  stageName: projectStage.name,
  stagePosition: projectStage.position,
};

type TaskRow = Awaited<
  ReturnType<ReturnType<Database["select"]>["from"]>
>[number] & {
  id: string;
  title: string;
  status: "pending" | "in_progress" | "blocked" | "completed";
  plannedStartDate: string | null;
  internalDueDate: string | null;
  updatedAt: Date;
  projectId: string;
  projectName: string;
  clientId: string;
  clientName: string;
  stageId: string;
  stageName: string;
  stagePosition: number;
};

function groupFor(
  row: Pick<TaskRow, "status" | "plannedStartDate" | "internalDueDate">,
  filters: Pick<MyWorkFilters, "today" | "weekEnd">,
): MyWorkTaskGroup {
  if (row.status === "completed") return "completed";
  if (!row.plannedStartDate || !row.internalDueDate) return "undated";
  if (row.internalDueDate < filters.today) return "overdue";
  if (row.plannedStartDate <= filters.today) return "today";
  if (row.plannedStartDate <= filters.weekEnd) return "this_week";
  return "future";
}

function toTask(
  row: TaskRow,
  responsibles: Map<string, TaskResponsibleRecord[]>,
  filters: MyWorkFilters,
): MyWorkTask {
  return {
    id: row.id,
    title: row.title,
    status: row.status,
    plannedStartDate: row.plannedStartDate,
    internalDueDate: row.internalDueDate,
    updatedAt: row.updatedAt,
    group: groupFor(row, filters),
    project: {
      id: row.projectId,
      name: row.projectName,
      client: { id: row.clientId, name: row.clientName },
    },
    stage: {
      id: row.stageId,
      name: row.stageName,
      position: row.stagePosition,
    },
    responsibles: responsibles.get(row.id) ?? [],
  };
}

function totalPages(total: number, pageSize: number) {
  return total === 0 ? 0 : Math.ceil(total / pageSize);
}

export function createDrizzleMyWorkStore(db: Database): MyWorkStore {
  function taskScope(organizationId: string, filters: MyWorkFilters) {
    return and(
      eq(projectTask.organizationId, organizationId),
      eq(project.organizationId, organizationId),
      eq(client.organizationId, organizationId),
      eq(projectStage.organizationId, organizationId),
      eq(project.status, "active"),
      isNull(project.archivedAt),
      isNull(projectTask.archivedAt),
      !filters.includeCompleted
        ? ne(projectTask.status, "completed")
        : undefined,
      filters.projectIds.length
        ? inArray(project.id, filters.projectIds)
        : undefined,
      filters.statuses.length
        ? inArray(projectTask.status, filters.statuses)
        : undefined,
      filters.dateFrom
        ? gte(projectTask.internalDueDate, filters.dateFrom)
        : undefined,
      filters.dateTo
        ? lte(projectTask.internalDueDate, filters.dateTo)
        : undefined,
      filters.search
        ? accentInsensitiveMatchesAny(
            [
              projectTask.title,
              project.name,
              client.name,
              project.internalReference,
            ],
            filters.search,
          )
        : undefined,
    );
  }

  async function loadResponsibles(organizationId: string, taskIds: string[]) {
    const byTask = new Map<string, TaskResponsibleRecord[]>();
    if (!taskIds.length) return byTask;
    const rows = await db
      .select({
        assignmentId: taskAssignment.id,
        taskId: taskAssignment.taskId,
        userId: taskAssignment.userId,
        snapshotName: taskAssignment.userNameSnapshot,
        snapshotEmail: taskAssignment.userEmailSnapshot,
        assignedAt: taskAssignment.assignedAt,
        memberId: member.id,
        currentName: user.name,
        currentEmail: user.email,
        alias: user.alias,
        avatarColor: user.avatarColor,
        position: member.position,
      })
      .from(taskAssignment)
      .leftJoin(
        member,
        and(
          eq(member.organizationId, taskAssignment.organizationId),
          eq(member.userId, taskAssignment.userId),
        ),
      )
      .leftJoin(user, eq(user.id, member.userId))
      .where(
        and(
          eq(taskAssignment.organizationId, organizationId),
          inArray(taskAssignment.taskId, taskIds),
          isNull(taskAssignment.endedAt),
        ),
      )
      .orderBy(asc(taskAssignment.assignedAt), asc(taskAssignment.id));
    for (const row of rows) {
      const currentName = row.currentName ?? row.snapshotName;
      const list = byTask.get(row.taskId) ?? [];
      list.push({
        assignmentId: row.assignmentId,
        userId: row.userId,
        userName: currentName,
        userEmail: row.currentEmail ?? row.snapshotEmail,
        userAlias: resolveUserAlias(row.alias, currentName),
        userAvatarColor: row.memberId === null ? null : row.avatarColor,
        userPosition:
          row.memberId !== null && isStudioMemberPosition(row.position)
            ? row.position
            : null,
        activeStudioMember: row.memberId !== null,
        assignedAt: row.assignedAt,
      });
      byTask.set(row.taskId, list);
    }
    return byTask;
  }

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

    async listAssignedCaseActions(organizationId, userId, filters) {
      const activeCaseMembership = db
        .select({ id: caseAssignments.id })
        .from(caseAssignments)
        .where(
          and(
            eq(caseAssignments.organizationId, organizationId),
            eq(caseAssignments.caseId, legalCases.id),
            eq(caseAssignments.userId, userId),
            isNull(caseAssignments.endedAt),
          ),
        );
      const where = and(
        eq(caseActions.organizationId, organizationId),
        eq(caseActions.assigneeUserId, userId),
        isNull(caseActions.archivedAt),
        isNull(legalCases.archivedAt),
        exists(activeCaseMembership),
        !filters.includeCompleted
          ? eq(caseActions.status, "pending")
          : undefined,
        filters.clientIds.length
          ? inArray(client.id, filters.clientIds)
          : undefined,
        filters.caseIds.length
          ? inArray(legalCases.id, filters.caseIds)
          : undefined,
        filters.types.length
          ? inArray(legalCases.type, filters.types)
          : undefined,
        filters.search
          ? accentInsensitiveMatchesAny(
              [caseActions.description, legalCases.identification, client.name],
              filters.search,
            )
          : undefined,
      );
      const [rows, totals] = await Promise.all([
        db
          .select({
            id: caseActions.id,
            description: caseActions.description,
            status: caseActions.status,
            updatedAt: caseActions.updatedAt,
            completedAt: caseActions.completedAt,
            caseId: legalCases.id,
            identification: legalCases.identification,
            type: legalCases.type,
            clientId: client.id,
            clientName: client.name,
          })
          .from(caseActions)
          .innerJoin(
            legalCases,
            and(
              eq(caseActions.caseId, legalCases.id),
              eq(caseActions.organizationId, legalCases.organizationId),
            ),
          )
          .innerJoin(
            client,
            and(
              eq(legalCases.clientId, client.id),
              eq(legalCases.organizationId, client.organizationId),
            ),
          )
          .where(where)
          .orderBy(
            asc(client.name),
            asc(legalCases.identification),
            desc(caseActions.updatedAt),
            asc(caseActions.id),
          )
          .limit(filters.pageSize)
          .offset((filters.page - 1) * filters.pageSize),
        db
          .select({ value: count() })
          .from(caseActions)
          .innerJoin(
            legalCases,
            and(
              eq(caseActions.caseId, legalCases.id),
              eq(caseActions.organizationId, legalCases.organizationId),
            ),
          )
          .innerJoin(
            client,
            and(
              eq(legalCases.clientId, client.id),
              eq(legalCases.organizationId, client.organizationId),
            ),
          )
          .where(where),
      ]);
      return {
        actions: rows.map((row) => ({
          id: row.id,
          description: row.description,
          status: row.status,
          updatedAt: row.updatedAt,
          completedAt: row.completedAt,
          case: {
            id: row.caseId,
            identification: row.identification,
            type: row.type,
            client: { id: row.clientId, name: row.clientName },
          },
        })),
        pagination: {
          page: filters.page,
          pageSize: filters.pageSize,
          total: totals[0]?.value ?? 0,
          totalPages: totalPages(totals[0]?.value ?? 0, filters.pageSize),
        },
      };
    },

    async listAssignedTasks(organizationId, userId, filters) {
      const activeAssignedIds = db
        .select({ id: taskAssignment.taskId })
        .from(taskAssignment)
        .where(
          and(
            eq(taskAssignment.organizationId, organizationId),
            eq(taskAssignment.userId, userId),
            isNull(taskAssignment.endedAt),
          ),
        );
      const where = and(
        taskScope(organizationId, filters),
        inArray(projectTask.id, activeAssignedIds),
      );
      const offset = (filters.page - 1) * filters.pageSize;
      const groupOrder = sql<number>`case
        when ${projectTask.status} = 'completed' then 5
        when ${projectTask.plannedStartDate} is null
          or ${projectTask.internalDueDate} is null then 4
        when ${projectTask.internalDueDate} < ${filters.today} then 0
        when ${projectTask.plannedStartDate} <= ${filters.today} then 1
        when ${projectTask.plannedStartDate} <= ${filters.weekEnd} then 2
        else 3 end`;
      const rows = await db
        .select(taskSelection)
        .from(projectTask)
        .innerJoin(
          project,
          and(
            eq(projectTask.projectId, project.id),
            eq(projectTask.organizationId, project.organizationId),
          ),
        )
        .innerJoin(
          client,
          and(
            eq(project.clientId, client.id),
            eq(project.organizationId, client.organizationId),
          ),
        )
        .innerJoin(
          projectStage,
          and(
            eq(projectTask.stageId, projectStage.id),
            eq(projectTask.projectId, projectStage.projectId),
            eq(projectTask.organizationId, projectStage.organizationId),
          ),
        )
        .where(where)
        .orderBy(
          groupOrder,
          sql`${projectTask.internalDueDate} asc nulls last`,
          desc(projectTask.updatedAt),
          asc(projectTask.id),
        )
        .limit(filters.pageSize)
        .offset(offset);
      const totals = await db
        .select({ value: count() })
        .from(projectTask)
        .innerJoin(
          project,
          and(
            eq(projectTask.projectId, project.id),
            eq(projectTask.organizationId, project.organizationId),
          ),
        )
        .innerJoin(
          client,
          and(
            eq(project.clientId, client.id),
            eq(project.organizationId, client.organizationId),
          ),
        )
        .innerJoin(
          projectStage,
          and(
            eq(projectTask.stageId, projectStage.id),
            eq(projectTask.projectId, projectStage.projectId),
            eq(projectTask.organizationId, projectStage.organizationId),
          ),
        )
        .where(where);
      const responsibles = await loadResponsibles(
        organizationId,
        rows.map(({ id }) => id),
      );
      const total = totals[0]?.value ?? 0;
      return {
        today: filters.today,
        tasks: rows.map((row) => toTask(row, responsibles, filters)),
        pagination: {
          page: filters.page,
          pageSize: filters.pageSize,
          total,
          totalPages: totalPages(total, filters.pageSize),
        },
      };
    },

    async listSupervisedProjects(organizationId, userId, filters) {
      const supervisedIds = db
        .select({ id: projectAssignment.projectId })
        .from(projectAssignment)
        .where(
          and(
            eq(projectAssignment.organizationId, organizationId),
            eq(projectAssignment.userId, userId),
            eq(projectAssignment.responsibility, "responsible"),
            isNull(projectAssignment.endedAt),
          ),
        );
      const projectWhere = and(
        eq(project.organizationId, organizationId),
        eq(project.status, "active"),
        isNull(project.archivedAt),
        inArray(project.id, supervisedIds),
        filters.search
          ? or(
              accentInsensitiveMatchesAny(
                [project.name, client.name, project.internalReference],
                filters.search,
              ),
              exists(
                db
                  .select({ id: projectTask.id })
                  .from(projectTask)
                  .where(
                    and(
                      eq(projectTask.organizationId, organizationId),
                      eq(projectTask.projectId, project.id),
                      isNull(projectTask.archivedAt),
                      !filters.includeCompleted
                        ? ne(projectTask.status, "completed")
                        : undefined,
                      filters.statuses.length
                        ? inArray(projectTask.status, filters.statuses)
                        : undefined,
                      filters.dateFrom
                        ? gte(projectTask.internalDueDate, filters.dateFrom)
                        : undefined,
                      filters.dateTo
                        ? lte(projectTask.internalDueDate, filters.dateTo)
                        : undefined,
                      accentInsensitiveLike(projectTask.title, filters.search),
                    ),
                  ),
              ),
            )
          : undefined,
        filters.projectIds.length
          ? inArray(project.id, filters.projectIds)
          : undefined,
      );
      const projectRows = await db
        .select({
          id: project.id,
          name: project.name,
          clientId: client.id,
          clientName: client.name,
          startDate: project.startDate,
          endDate: sql<string>`${project.endDate}`,
        })
        .from(project)
        .innerJoin(
          client,
          and(
            eq(project.clientId, client.id),
            eq(project.organizationId, client.organizationId),
          ),
        )
        .where(projectWhere)
        .orderBy(
          asc(project.endDate),
          asc(project.startDate),
          asc(project.name),
          asc(project.id),
        )
        .limit(filters.pageSize)
        .offset((filters.page - 1) * filters.pageSize);
      const totals = await db
        .select({ value: count() })
        .from(project)
        .innerJoin(
          client,
          and(
            eq(project.clientId, client.id),
            eq(project.organizationId, client.organizationId),
          ),
        )
        .where(projectWhere);
      const ids = projectRows.map(({ id }) => id);
      const countRows = ids.length
        ? await db
            .select({
              projectId: projectTask.projectId,
              pending: sql<number>`count(distinct ${projectTask.id}) filter (where ${projectTask.status} = 'pending')::integer`,
              inProgress: sql<number>`count(distinct ${projectTask.id}) filter (where ${projectTask.status} = 'in_progress')::integer`,
              blocked: sql<number>`count(distinct ${projectTask.id}) filter (where ${projectTask.status} = 'blocked')::integer`,
              completed: sql<number>`count(distinct ${projectTask.id}) filter (where ${projectTask.status} = 'completed')::integer`,
              unassigned: sql<number>`count(distinct ${projectTask.id}) filter (where ${taskAssignment.id} is null)::integer`,
              total: sql<number>`count(distinct ${projectTask.id})::integer`,
            })
            .from(projectTask)
            .leftJoin(
              taskAssignment,
              and(
                eq(taskAssignment.organizationId, projectTask.organizationId),
                eq(taskAssignment.projectId, projectTask.projectId),
                eq(taskAssignment.taskId, projectTask.id),
                isNull(taskAssignment.endedAt),
              ),
            )
            .where(
              and(
                eq(projectTask.organizationId, organizationId),
                inArray(projectTask.projectId, ids),
                isNull(projectTask.archivedAt),
              ),
            )
            .groupBy(projectTask.projectId)
        : [];
      const countsByProject = new Map(
        countRows.map((row) => [row.projectId, row] as const),
      );
      const rows = ids.length
        ? await db
            .select(taskSelection)
            .from(projectTask)
            .innerJoin(
              project,
              and(
                eq(projectTask.projectId, project.id),
                eq(projectTask.organizationId, project.organizationId),
              ),
            )
            .innerJoin(
              client,
              and(
                eq(project.clientId, client.id),
                eq(project.organizationId, client.organizationId),
              ),
            )
            .innerJoin(
              projectStage,
              and(
                eq(projectTask.stageId, projectStage.id),
                eq(projectTask.projectId, projectStage.projectId),
                eq(projectTask.organizationId, projectStage.organizationId),
              ),
            )
            .where(
              and(
                taskScope(organizationId, { ...filters, projectIds: ids }),
                inArray(projectTask.projectId, ids),
              ),
            )
            .orderBy(
              sql`${projectTask.internalDueDate} asc nulls last`,
              desc(projectTask.updatedAt),
              asc(projectTask.id),
            )
        : [];
      const responsibles = await loadResponsibles(
        organizationId,
        rows.map(({ id }) => id),
      );
      const tasks = rows.map((row) => toTask(row, responsibles, filters));
      const projects = projectRows.map((row) => {
        const projectTasks = tasks.filter((task) => task.project.id === row.id);
        const taskCounts = countsByProject.get(row.id);
        const attention = projectTasks.filter((task) => {
          const dueSoon =
            task.internalDueDate !== null &&
            task.internalDueDate >= filters.today &&
            task.internalDueDate <= filters.weekEnd;
          return (
            task.status !== "completed" &&
            ((task.internalDueDate !== null &&
              task.internalDueDate < filters.today) ||
              task.status === "blocked" ||
              task.responsibles.length === 0 ||
              dueSoon)
          );
        });
        const preview = attention
          .filter(
            (task) =>
              !task.responsibles.some(
                (responsible) => responsible.userId === userId,
              ),
          )
          .slice(0, filters.previewLimit);
        return {
          id: row.id,
          name: row.name,
          client: { id: row.clientId, name: row.clientName },
          startDate: row.startDate,
          endDate: row.endDate,
          counts: {
            pending: taskCounts?.pending ?? 0,
            inProgress: taskCounts?.inProgress ?? 0,
            blocked: taskCounts?.blocked ?? 0,
            completed: taskCounts?.completed ?? 0,
            unassigned: taskCounts?.unassigned ?? 0,
            total: taskCounts?.total ?? 0,
          },
          attentionTasks: preview,
        };
      });
      const total = totals[0]?.value ?? 0;
      return {
        today: filters.today,
        projects,
        pagination: {
          page: filters.page,
          pageSize: filters.pageSize,
          total,
          totalPages: totalPages(total, filters.pageSize),
        },
      };
    },
  };
}
