import {
  and,
  asc,
  count,
  eq,
  gte,
  inArray,
  isNotNull,
  isNull,
  lte,
  lt,
  max,
  ne,
  or,
  sql,
} from "drizzle-orm";

import { member, organization, user } from "../db/auth-schema";
import { client } from "../db/client-schema";
import type { createDatabase } from "../db/client";
import { accentInsensitiveMatchesAny } from "../db/search-text";
import {
  projectActivity,
  projectAssignment,
} from "../db/project-collaboration-schema";
import { project } from "../db/project-schema";
import { projectEvent } from "../db/project-event-schema";
import { projectStage } from "../db/project-stage-schema";
import { projectTask, taskAssignment } from "../db/project-task-schema";
import type { ProjectTaskStore } from "./project-task-service";
import type {
  ActiveProjectTaskMember,
  ProjectTaskCalendarFilters,
  ProjectTaskCalendarMarker,
  ProjectTaskCalendarRecord,
  ProjectTaskRecord,
  ProjectTaskStatus,
  TaskResponsibleRecord,
} from "./project-task-types";
import { clampCalendarDate } from "../organizations/organization-time-zone";
import { resolveUserAlias } from "../identity/user-alias";
import { isStudioMemberPosition } from "../identity/studio-member-position";

type Database = ReturnType<typeof createDatabase>["db"];
type QueryDatabase = Pick<Database, "select">;

function toStudioMemberPosition(value: unknown) {
  return isStudioMemberPosition(value) ? value : null;
}

const memberSelection = {
  memberId: member.id,
  userId: member.userId,
  organizationId: member.organizationId,
  organizationTimeZone: organization.timeZone,
  name: user.name,
  email: user.email,
  alias: user.alias,
};

const taskBaseSelection = {
  id: projectTask.id,
  organizationId: projectTask.organizationId,
  projectId: projectTask.projectId,
  stageId: projectTask.stageId,
  title: projectTask.title,
  description: projectTask.description,
  status: projectTask.status,
  plannedStartDate: projectTask.plannedStartDate,
  internalDueDate: projectTask.internalDueDate,
  position: projectTask.position,
  archivedAt: projectTask.archivedAt,
  createdAt: projectTask.createdAt,
  updatedAt: projectTask.updatedAt,
};

const taskWithStageSelection = {
  ...taskBaseSelection,
  stageName: projectStage.name,
  stagePosition: projectStage.position,
};

const responsibleSnapshotSelection = {
  assignmentId: taskAssignment.id,
  taskId: taskAssignment.taskId,
  userId: taskAssignment.userId,
  userName: taskAssignment.userNameSnapshot,
  userEmail: taskAssignment.userEmailSnapshot,
  assignedAt: taskAssignment.assignedAt,
};

const responsibleWithIdentitySelection = {
  ...responsibleSnapshotSelection,
  currentMemberId: member.id,
  currentUserName: user.name,
  userAlias: user.alias,
  userAvatarColor: user.avatarColor,
  userPosition: member.position,
};

const projectMemberSelection = {
  userId: projectAssignment.userId,
  userName: projectAssignment.userNameSnapshot,
  userEmail: projectAssignment.userEmailSnapshot,
  currentUserName: user.name,
  userAlias: user.alias,
  userAvatarColor: user.avatarColor,
  userPosition: member.position,
};

type TaskWithStageRow = Omit<ProjectTaskRecord, "responsibles">;

function taskScope(organizationId: string, projectId: string, taskId?: string) {
  return and(
    eq(projectTask.organizationId, organizationId),
    eq(projectTask.projectId, projectId),
    taskId ? eq(projectTask.id, taskId) : undefined,
  );
}

function activityValues(
  createId: () => string,
  actor: ActiveProjectTaskMember,
  projectId: string,
  type: string,
  subject: { userId: string | null; name: string | null } | null,
  details: Record<string, string | null>,
) {
  return {
    id: createId(),
    organizationId: actor.organizationId,
    projectId,
    type,
    actorUserId: actor.userId,
    actorNameSnapshot: actor.name,
    subjectUserId: subject?.userId ?? null,
    subjectNameSnapshot: subject?.name ?? null,
    details,
  };
}

function hasInvalidTaskDates(
  projectStartDate: string,
  plannedStartDate: string | null,
  internalDueDate: string | null,
) {
  return (
    (internalDueDate !== null && plannedStartDate === null) ||
    (internalDueDate !== null && internalDueDate < projectStartDate) ||
    (plannedStartDate !== null && plannedStartDate < projectStartDate) ||
    (plannedStartDate !== null &&
      internalDueDate !== null &&
      plannedStartDate > internalDueDate)
  );
}

function isTaskAssignmentUniqueViolation(error: unknown) {
  if (typeof error !== "object" || error === null) return false;
  const postgresError = error as {
    code?: string;
    constraint_name?: string;
    constraint?: string;
  };
  return (
    postgresError.code === "23505" &&
    (postgresError.constraint_name === "task_assignment_active_user_unique" ||
      postgresError.constraint === "task_assignment_active_user_unique")
  );
}

async function loadResponsibles(
  source: QueryDatabase,
  organizationId: string,
  projectId: string | undefined,
  taskIds: string[],
) {
  if (taskIds.length === 0) return new Map<string, TaskResponsibleRecord[]>();
  const rows = await source
    .select(responsibleWithIdentitySelection)
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
        projectId ? eq(taskAssignment.projectId, projectId) : undefined,
        inArray(taskAssignment.taskId, taskIds),
        isNull(taskAssignment.endedAt),
      ),
    )
    .orderBy(asc(taskAssignment.userNameSnapshot), asc(taskAssignment.id));
  const byTask = new Map<string, TaskResponsibleRecord[]>();
  for (const {
    taskId,
    currentMemberId,
    currentUserName,
    userAlias,
    userAvatarColor,
    userPosition,
    ...snapshot
  } of rows) {
    const current = byTask.get(taskId) ?? [];
    current.push({
      ...snapshot,
      userAlias: resolveUserAlias(
        currentMemberId === null ? null : userAlias,
        currentMemberId === null
          ? snapshot.userName
          : (currentUserName ?? snapshot.userName),
      ),
      userAvatarColor: currentMemberId === null ? null : userAvatarColor,
      userPosition:
        currentMemberId !== null ? toStudioMemberPosition(userPosition) : null,
      activeStudioMember: currentMemberId !== null,
    });
    byTask.set(taskId, current);
  }
  return byTask;
}

function hydrateTasks(
  rows: TaskWithStageRow[],
  responsibles: Map<string, TaskResponsibleRecord[]>,
) {
  return rows.map((row) => ({
    ...row,
    responsibles: responsibles.get(row.id) ?? [],
  }));
}

export function createDrizzleProjectTaskStore(
  db: Database,
  createId: () => string = () => crypto.randomUUID(),
): ProjectTaskStore {
  function calendarTaskWhere(
    organizationId: string,
    filters: ProjectTaskCalendarFilters,
    includeVisibleRange: boolean,
  ) {
    const responsibleTaskIds = filters.responsibleUserIds.length
      ? db
          .select({ id: taskAssignment.taskId })
          .from(taskAssignment)
          .where(
            and(
              eq(taskAssignment.organizationId, organizationId),
              isNull(taskAssignment.endedAt),
              inArray(taskAssignment.userId, filters.responsibleUserIds),
            ),
          )
      : undefined;

    return and(
      eq(projectTask.organizationId, organizationId),
      eq(project.organizationId, organizationId),
      eq(client.organizationId, organizationId),
      eq(projectStage.organizationId, organizationId),
      isNull(projectTask.archivedAt),
      isNull(project.archivedAt),
      filters.projectIds.length
        ? inArray(projectTask.projectId, filters.projectIds)
        : undefined,
      filters.statuses.length
        ? inArray(projectTask.status, filters.statuses)
        : undefined,
      responsibleTaskIds
        ? inArray(projectTask.id, responsibleTaskIds)
        : undefined,
      filters.search
        ? accentInsensitiveMatchesAny(
            [projectTask.title, project.name, client.name],
            filters.search,
          )
        : undefined,
      filters.overdueOnly
        ? and(
            ne(projectTask.status, "completed"),
            isNotNull(projectTask.internalDueDate),
            lt(projectTask.internalDueDate, filters.today),
          )
        : undefined,
      includeVisibleRange
        ? and(
            isNotNull(projectTask.plannedStartDate),
            lte(projectTask.plannedStartDate, filters.to),
            gte(
              sql<string>`coalesce(${projectTask.internalDueDate}, ${projectTask.plannedStartDate})`,
              filters.from,
            ),
          )
        : undefined,
    );
  }

  async function lockedActor(
    transaction: Parameters<Parameters<Database["transaction"]>[0]>[0],
    actor: ActiveProjectTaskMember,
  ) {
    const rows = await transaction
      .select(memberSelection)
      .from(member)
      .innerJoin(user, eq(member.userId, user.id))
      .innerJoin(organization, eq(member.organizationId, organization.id))
      .where(
        and(
          eq(member.id, actor.memberId),
          eq(member.userId, actor.userId),
          eq(member.organizationId, actor.organizationId),
        ),
      )
      .limit(1)
      .for("update");
    return rows[0] ?? null;
  }

  async function currentTask(
    transaction: Parameters<Parameters<Database["transaction"]>[0]>[0],
    actor: ActiveProjectTaskMember,
    projectId: string,
    taskId: string,
  ) {
    const rows = await transaction
      .select(taskWithStageSelection)
      .from(projectTask)
      .innerJoin(projectStage, eq(projectTask.stageId, projectStage.id))
      .where(taskScope(actor.organizationId, projectId, taskId))
      .limit(1)
      .for("update");
    return (rows[0] as TaskWithStageRow | undefined) ?? null;
  }

  async function lockedProject(
    transaction: Parameters<Parameters<Database["transaction"]>[0]>[0],
    organizationId: string,
    projectId: string,
  ) {
    const rows = await transaction
      .select({
        id: project.id,
        startDate: project.startDate,
        archivedAt: project.archivedAt,
      })
      .from(project)
      .where(
        and(
          eq(project.organizationId, organizationId),
          eq(project.id, projectId),
        ),
      )
      .limit(1)
      .for("update");
    return rows[0] ?? null;
  }

  async function hydrateOne(
    transaction: Parameters<Parameters<Database["transaction"]>[0]>[0],
    row: TaskWithStageRow,
  ) {
    const responsibles = await loadResponsibles(
      transaction,
      row.organizationId,
      row.projectId,
      [row.id],
    );
    return hydrateTasks([row], responsibles)[0]!;
  }

  async function changeArchivedState(
    values: Parameters<ProjectTaskStore["archive"]>[0],
    target: "archived" | "active",
  ) {
    return db.transaction(async (transaction) => {
      const actor = await lockedActor(transaction, values.actor);
      if (!actor) return { status: "conflict" as const };
      const currentProject = await lockedProject(
        transaction,
        actor.organizationId,
        values.projectId,
      );
      if (!currentProject) return { status: "not_found" as const };
      if (currentProject.archivedAt) {
        return { status: "project_archived" as const };
      }
      const current = await currentTask(
        transaction,
        actor,
        values.projectId,
        values.taskId,
      );
      if (!current) return { status: "not_found" as const };
      if (target === "archived" ? current.archivedAt : !current.archivedAt) {
        return { status: "conflict" as const };
      }

      const now = new Date();
      const rows = await transaction
        .update(projectTask)
        .set(
          target === "archived"
            ? {
                archivedAt: now,
                archivedByUserId: actor.userId,
                archivedByNameSnapshot: actor.name,
                updatedAt: now,
              }
            : {
                archivedAt: null,
                archivedByUserId: null,
                archivedByNameSnapshot: null,
                updatedAt: now,
              },
        )
        .where(
          and(
            taskScope(actor.organizationId, values.projectId, values.taskId),
            target === "archived"
              ? isNull(projectTask.archivedAt)
              : isNotNull(projectTask.archivedAt),
          ),
        )
        .returning(taskBaseSelection);
      const updated = rows[0];
      if (!updated) return { status: "conflict" as const };

      await transaction
        .insert(projectActivity)
        .values(
          activityValues(
            createId,
            actor,
            values.projectId,
            target === "archived" ? "task.archived" : "task.restored",
            null,
            { taskId: current.id, taskTitle: current.title },
          ),
        );
      const record = await hydrateOne(transaction, {
        ...updated,
        stageName: current.stageName,
        stagePosition: current.stagePosition,
      });
      return { status: "updated" as const, task: record };
    });
  }

  return {
    async findActiveMember(userId, organizationId) {
      const rows = await db
        .select(memberSelection)
        .from(member)
        .innerJoin(user, eq(member.userId, user.id))
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

    async find(organizationId, projectId, taskId) {
      const rows = await db
        .select(taskWithStageSelection)
        .from(projectTask)
        .innerJoin(projectStage, eq(projectTask.stageId, projectStage.id))
        .where(taskScope(organizationId, projectId, taskId))
        .limit(1);
      const row = rows[0] as TaskWithStageRow | undefined;
      if (!row) return null;
      const responsibles = await loadResponsibles(
        db,
        organizationId,
        projectId,
        [taskId],
      );
      return hydrateTasks([row], responsibles)[0]!;
    },

    async list(organizationId, projectId, { view, page, pageSize, stageId }) {
      const projects = await db
        .select({ id: project.id })
        .from(project)
        .where(
          and(
            eq(project.organizationId, organizationId),
            eq(project.id, projectId),
          ),
        )
        .limit(1);
      if (projects.length === 0) {
        return { projectExists: false, tasks: [], total: 0 };
      }

      const archivedFilter =
        view === "active"
          ? isNull(projectTask.archivedAt)
          : isNotNull(projectTask.archivedAt);
      const where = and(
        taskScope(organizationId, projectId),
        archivedFilter,
        stageId ? eq(projectTask.stageId, stageId) : undefined,
      );
      const [rows, totals] = await Promise.all([
        db
          .select(taskWithStageSelection)
          .from(projectTask)
          .innerJoin(projectStage, eq(projectTask.stageId, projectStage.id))
          .where(where)
          .orderBy(
            asc(projectStage.position),
            asc(projectTask.position),
            asc(projectTask.id),
          )
          .limit(pageSize)
          .offset((page - 1) * pageSize),
        db.select({ value: count() }).from(projectTask).where(where),
      ]);
      const taskRows = rows as TaskWithStageRow[];
      const responsibles = await loadResponsibles(
        db,
        organizationId,
        projectId,
        taskRows.map(({ id }) => id),
      );
      return {
        projectExists: true,
        tasks: hydrateTasks(taskRows, responsibles),
        total: totals[0]?.value ?? 0,
      };
    },

    async calendar(organizationId, filters) {
      const calendarSelection = {
        id: projectTask.id,
        title: projectTask.title,
        status: projectTask.status,
        plannedStartDate: projectTask.plannedStartDate,
        internalDueDate: projectTask.internalDueDate,
        position: projectTask.position,
        projectId: project.id,
        projectName: project.name,
        projectStartDate: project.startDate,
        clientId: client.id,
        clientName: client.name,
        stageId: projectStage.id,
        stageName: projectStage.name,
        stagePosition: projectStage.position,
      };
      const taskRows = await db
        .select(calendarSelection)
        .from(projectTask)
        .innerJoin(project, eq(project.id, projectTask.projectId))
        .innerJoin(client, eq(client.id, project.clientId))
        .innerJoin(projectStage, eq(projectStage.id, projectTask.stageId))
        .where(calendarTaskWhere(organizationId, filters, true))
        .orderBy(
          asc(projectTask.plannedStartDate),
          asc(projectTask.internalDueDate),
          asc(project.name),
          asc(projectStage.position),
          asc(projectTask.position),
          asc(projectTask.id),
        )
        .limit(501);
      const visibleRows = taskRows.slice(0, 500);
      const responsibles = await loadResponsibles(
        db,
        organizationId,
        undefined,
        visibleRows.map(({ id }) => id),
      );
      const tasks: ProjectTaskCalendarRecord[] = visibleRows.flatMap((row) =>
        row.plannedStartDate
          ? [
              {
                id: row.id,
                title: row.title,
                status: row.status,
                plannedStartDate: row.plannedStartDate,
                internalDueDate: row.internalDueDate,
                position: row.position,
                project: {
                  id: row.projectId,
                  name: row.projectName,
                  startDate: row.projectStartDate,
                  client: { id: row.clientId, name: row.clientName },
                },
                stage: {
                  id: row.stageId,
                  name: row.stageName,
                  position: row.stagePosition,
                },
                responsibles: responsibles.get(row.id) ?? [],
              },
            ]
          : [],
      );

      const taskScopedMarkers =
        filters.responsibleUserIds.length > 0 ||
        filters.statuses.length > 0 ||
        filters.overdueOnly;
      const needsTaskMatches = taskScopedMarkers || Boolean(filters.search);
      const matchingProjectRows = needsTaskMatches
        ? await db
            .select({ projectId: projectTask.projectId })
            .from(projectTask)
            .innerJoin(project, eq(project.id, projectTask.projectId))
            .innerJoin(client, eq(client.id, project.clientId))
            .innerJoin(projectStage, eq(projectStage.id, projectTask.stageId))
            .where(calendarTaskWhere(organizationId, filters, false))
            .groupBy(projectTask.projectId)
        : [];
      const matchingProjectIds = matchingProjectRows.map(
        ({ projectId }) => projectId,
      );
      const taskMatch = matchingProjectIds.length
        ? inArray(project.id, matchingProjectIds)
        : sql<boolean>`false`;
      const markerProjectWhere = and(
        eq(project.organizationId, organizationId),
        eq(client.organizationId, organizationId),
        isNull(project.archivedAt),
        filters.projectIds.length
          ? inArray(project.id, filters.projectIds)
          : undefined,
        taskScopedMarkers
          ? taskMatch
          : filters.search
            ? or(
                accentInsensitiveMatchesAny(
                  [project.name, client.name],
                  filters.search,
                ),
                taskMatch,
              )
            : undefined,
      );
      const periodRows = await db
        .select({
          projectId: project.id,
          projectName: project.name,
          clientName: client.name,
          startDate: project.startDate,
          endDate: sql<string>`${project.endDate}`,
        })
        .from(project)
        .innerJoin(client, eq(client.id, project.clientId))
        .where(markerProjectWhere)
        .orderBy(asc(project.name), asc(project.id));
      const eventRows = await db
        .select({
          projectId: project.id,
          projectName: project.name,
          clientName: client.name,
          eventId: projectEvent.id,
          eventTitle: projectEvent.title,
          eventType: projectEvent.type,
          date: projectEvent.date,
        })
        .from(projectEvent)
        .innerJoin(project, eq(project.id, projectEvent.projectId))
        .innerJoin(client, eq(client.id, project.clientId))
        .where(
          and(
            eq(projectEvent.organizationId, organizationId),
            markerProjectWhere,
            gte(projectEvent.date, filters.from),
            lte(projectEvent.date, filters.to),
          ),
        )
        .orderBy(asc(projectEvent.date), asc(projectEvent.id));
      const markers: ProjectTaskCalendarMarker[] = periodRows
        .flatMap(
          (row) =>
            [
              ...(row.startDate >= filters.from && row.startDate <= filters.to
                ? [
                    {
                      projectId: row.projectId,
                      projectName: row.projectName,
                      clientName: row.clientName,
                      kind: "project_start" as const,
                      date: row.startDate,
                    },
                  ]
                : []),
              ...(row.endDate >= filters.from && row.endDate <= filters.to
                ? [
                    {
                      projectId: row.projectId,
                      projectName: row.projectName,
                      clientName: row.clientName,
                      kind: "project_end" as const,
                      date: row.endDate,
                    },
                  ]
                : []),
            ] as ProjectTaskCalendarMarker[],
        )
        .concat(
          eventRows.map((row) => ({
            projectId: row.projectId,
            projectName: row.projectName,
            clientName: row.clientName,
            kind: "project_event" as const,
            date: row.date,
            eventId: row.eventId,
            eventTitle: row.eventTitle,
            eventType: row.eventType,
          })),
        );
      const totals = await db
        .select({ value: count() })
        .from(projectTask)
        .innerJoin(project, eq(project.id, projectTask.projectId))
        .innerJoin(client, eq(client.id, project.clientId))
        .innerJoin(projectStage, eq(projectStage.id, projectTask.stageId))
        .where(
          and(
            calendarTaskWhere(organizationId, filters, false),
            isNull(projectTask.plannedStartDate),
          ),
        );

      return {
        tasks,
        markers,
        undatedTaskCount: totals[0]?.value ?? 0,
        truncated: taskRows.length > 500,
      };
    },

    async listUndated(organizationId, filters) {
      const commonFilters: ProjectTaskCalendarFilters = {
        ...filters,
        from: "0001-01-01",
        to: "9999-12-31",
      };
      const where = and(
        calendarTaskWhere(organizationId, commonFilters, false),
        isNull(projectTask.plannedStartDate),
      );
      const selection = {
        id: projectTask.id,
        title: projectTask.title,
        status: projectTask.status,
        plannedStartDate: projectTask.plannedStartDate,
        internalDueDate: projectTask.internalDueDate,
        position: projectTask.position,
        projectId: project.id,
        projectName: project.name,
        projectStartDate: project.startDate,
        clientId: client.id,
        clientName: client.name,
        stageId: projectStage.id,
        stageName: projectStage.name,
        stagePosition: projectStage.position,
      };
      const [rows, totals] = await Promise.all([
        db
          .select(selection)
          .from(projectTask)
          .innerJoin(project, eq(project.id, projectTask.projectId))
          .innerJoin(client, eq(client.id, project.clientId))
          .innerJoin(projectStage, eq(projectStage.id, projectTask.stageId))
          .where(where)
          .orderBy(
            asc(project.name),
            asc(projectStage.position),
            asc(projectTask.position),
            asc(projectTask.id),
          )
          .limit(filters.pageSize)
          .offset((filters.page - 1) * filters.pageSize),
        db
          .select({ value: count() })
          .from(projectTask)
          .innerJoin(project, eq(project.id, projectTask.projectId))
          .innerJoin(client, eq(client.id, project.clientId))
          .innerJoin(projectStage, eq(projectStage.id, projectTask.stageId))
          .where(where),
      ]);
      const responsibles = await loadResponsibles(
        db,
        organizationId,
        undefined,
        rows.map(({ id }) => id),
      );
      return {
        tasks: rows.map((row) => ({
          id: row.id,
          title: row.title,
          status: row.status,
          plannedStartDate: null,
          internalDueDate: row.internalDueDate,
          position: row.position,
          project: {
            id: row.projectId,
            name: row.projectName,
            startDate: row.projectStartDate,
            client: { id: row.clientId, name: row.clientName },
          },
          stage: {
            id: row.stageId,
            name: row.stageName,
            position: row.stagePosition,
          },
          responsibles: responsibles.get(row.id) ?? [],
        })),
        total: totals[0]?.value ?? 0,
      };
    },

    async schedule(organizationId, projectId) {
      const projects = await db
        .select({
          startDate: project.startDate,
          endDate: sql<string>`${project.endDate}`,
          timeZone: organization.timeZone,
        })
        .from(project)
        .innerJoin(organization, eq(organization.id, project.organizationId))
        .where(
          and(
            eq(project.organizationId, organizationId),
            eq(project.id, projectId),
          ),
        )
        .limit(1);
      const currentProject = projects[0];
      if (!currentProject) return { projectExists: false, schedule: null };

      const [stages, tasks, events] = await Promise.all([
        db
          .select({
            id: projectStage.id,
            name: projectStage.name,
            position: projectStage.position,
          })
          .from(projectStage)
          .where(
            and(
              eq(projectStage.organizationId, organizationId),
              eq(projectStage.projectId, projectId),
            ),
          )
          .orderBy(asc(projectStage.position), asc(projectStage.id)),
        db
          .select({
            id: projectTask.id,
            title: projectTask.title,
            stageId: projectTask.stageId,
            status: projectTask.status,
            plannedStartDate: projectTask.plannedStartDate,
            internalDueDate: projectTask.internalDueDate,
            position: projectTask.position,
          })
          .from(projectTask)
          .where(
            and(
              taskScope(organizationId, projectId),
              isNull(projectTask.archivedAt),
            ),
          ),
        db
          .select({
            id: projectEvent.id,
            title: projectEvent.title,
            type: projectEvent.type,
            date: projectEvent.date,
          })
          .from(projectEvent)
          .where(
            and(
              eq(projectEvent.organizationId, organizationId),
              eq(projectEvent.projectId, projectId),
            ),
          )
          .orderBy(asc(projectEvent.date), asc(projectEvent.id)),
      ]);

      const taskDatesByStage = new Map<
        string,
        Array<{
          plannedStartDate: string | null;
          internalDueDate: string | null;
        }>
      >();
      const taskStatusCountsByStage = new Map<
        string,
        {
          pending: number;
          inProgress: number;
          blocked: number;
          completed: number;
        }
      >();
      const tasksByStage = new Map<
        string,
        Array<{
          id: string;
          title: string;
          status: ProjectTaskStatus;
          plannedStartDate: string | null;
          internalDueDate: string | null;
          position: number;
        }>
      >();
      for (const task of tasks) {
        const counts = taskStatusCountsByStage.get(task.stageId) ?? {
          pending: 0,
          inProgress: 0,
          blocked: 0,
          completed: 0,
        };
        if (task.status === "in_progress") counts.inProgress += 1;
        else counts[task.status] += 1;
        taskStatusCountsByStage.set(task.stageId, counts);

        const stageTasks = tasksByStage.get(task.stageId) ?? [];
        stageTasks.push({
          id: task.id,
          title: task.title,
          status: task.status,
          plannedStartDate: task.plannedStartDate,
          internalDueDate: task.internalDueDate,
          position: task.position,
        });
        tasksByStage.set(task.stageId, stageTasks);

        if (!task.plannedStartDate && !task.internalDueDate) continue;
        const current = taskDatesByStage.get(task.stageId) ?? [];
        current.push(task);
        taskDatesByStage.set(task.stageId, current);
      }

      return {
        projectExists: true,
        schedule: {
          project: currentProject,
          events,
          stages: stages.map((stage, index) => {
            const dates = taskDatesByStage.get(stage.id) ?? [];
            const plannedStarts = dates.flatMap(({ plannedStartDate }) =>
              plannedStartDate ? [plannedStartDate] : [],
            );
            const dueDates = dates.flatMap(({ internalDueDate }) =>
              internalDueDate ? [internalDueDate] : [],
            );
            const usesProjectStartFallback = index === 0 && dates.length > 0;
            return {
              ...stage,
              startDate: usesProjectStartFallback
                ? currentProject.startDate
                : (plannedStarts.sort()[0] ?? null),
              endDate: dueDates.sort().at(-1) ?? null,
              scheduledTaskCount: dates.length,
              taskStatusCounts: taskStatusCountsByStage.get(stage.id) ?? {
                pending: 0,
                inProgress: 0,
                blocked: 0,
                completed: 0,
              },
              tasks: (tasksByStage.get(stage.id) ?? []).sort((left, right) =>
                left.position === right.position
                  ? left.id.localeCompare(right.id)
                  : left.position - right.position,
              ),
              usesProjectStartFallback,
            };
          }),
        },
      };
    },

    async create(values) {
      try {
        return await db.transaction(async (transaction) => {
          const actor = await lockedActor(transaction, values.actor);
          if (!actor) return { status: "conflict" as const };

          const currentProject = await lockedProject(
            transaction,
            actor.organizationId,
            values.projectId,
          );
          if (!currentProject) return { status: "not_found" as const };
          if (currentProject.archivedAt) {
            return { status: "project_archived" as const };
          }
          const automaticPlannedStartDate =
            values.plannedStartDate === null && values.automaticPlannedStartDate
              ? clampCalendarDate(
                  values.automaticPlannedStartDate,
                  currentProject.startDate,
                  values.internalDueDate,
                )
              : null;
          const plannedStartDate =
            values.plannedStartDate ?? automaticPlannedStartDate;
          if (
            hasInvalidTaskDates(
              currentProject.startDate,
              plannedStartDate,
              values.internalDueDate,
            )
          ) {
            return { status: "invalid_dates" as const };
          }

          const stages = await transaction
            .select({
              id: projectStage.id,
              name: projectStage.name,
              position: projectStage.position,
            })
            .from(projectStage)
            .where(
              and(
                eq(projectStage.organizationId, actor.organizationId),
                eq(projectStage.projectId, values.projectId),
                eq(projectStage.id, values.stageId),
              ),
            )
            .limit(1);
          const stage = stages[0];
          if (!stage) return { status: "not_found" as const };

          const positions = await transaction
            .select({ value: max(projectTask.position) })
            .from(projectTask)
            .where(
              and(
                taskScope(actor.organizationId, values.projectId),
                eq(projectTask.stageId, values.stageId),
              ),
            );
          const position = (positions[0]?.value ?? -1) + 1;

          const projectMembers =
            values.responsibleUserIds.length === 0
              ? []
              : await transaction
                  .select(projectMemberSelection)
                  .from(projectAssignment)
                  .innerJoin(
                    member,
                    and(
                      eq(
                        member.organizationId,
                        projectAssignment.organizationId,
                      ),
                      eq(member.userId, projectAssignment.userId),
                    ),
                  )
                  .innerJoin(user, eq(user.id, member.userId))
                  .where(
                    and(
                      eq(
                        projectAssignment.organizationId,
                        actor.organizationId,
                      ),
                      eq(projectAssignment.projectId, values.projectId),
                      isNull(projectAssignment.endedAt),
                      inArray(
                        projectAssignment.userId,
                        values.responsibleUserIds,
                      ),
                    ),
                  )
                  .for("update");
          if (projectMembers.length !== values.responsibleUserIds.length) {
            return { status: "invalid_responsibles" as const };
          }

          const createdRows = await transaction
            .insert(projectTask)
            .values({
              id: values.id,
              organizationId: actor.organizationId,
              projectId: values.projectId,
              stageId: values.stageId,
              title: values.title,
              description: values.description,
              status: values.status,
              plannedStartDate,
              internalDueDate: values.internalDueDate,
              position,
              createdByUserId: actor.userId,
              createdByNameSnapshot: actor.name,
            })
            .returning(taskBaseSelection);
          const created = createdRows[0]!;

          const assignmentRows = projectMembers.map((responsible) => ({
            id: createId(),
            organizationId: actor.organizationId,
            projectId: values.projectId,
            taskId: created.id,
            userId: responsible.userId,
            userNameSnapshot: responsible.userName,
            userEmailSnapshot: responsible.userEmail,
            assignedByUserId: actor.userId,
            assignedByNameSnapshot: actor.name,
          }));
          const createdAssignments =
            assignmentRows.length > 0
              ? await transaction
                  .insert(taskAssignment)
                  .values(assignmentRows)
                  .returning(responsibleSnapshotSelection)
              : [];

          await transaction.insert(projectActivity).values([
            activityValues(
              createId,
              actor,
              values.projectId,
              "task.created",
              null,
              { taskId: created.id, taskTitle: created.title },
            ),
            ...assignmentRows.map((assignment) =>
              activityValues(
                createId,
                actor,
                values.projectId,
                "task_assignment.added",
                {
                  userId: assignment.userId,
                  name: assignment.userNameSnapshot,
                },
                { taskId: created.id, taskTitle: created.title },
              ),
            ),
          ]);

          const projectMemberByUserId = new Map(
            projectMembers.map((responsible) => [
              responsible.userId,
              responsible,
            ]),
          );
          const responsibles = new Map<string, TaskResponsibleRecord[]>([
            [
              created.id,
              createdAssignments.map(({ taskId: _taskId, ...responsible }) => ({
                ...responsible,
                userAlias: resolveUserAlias(
                  projectMemberByUserId.get(responsible.userId)?.userAlias,
                  projectMemberByUserId.get(responsible.userId)
                    ?.currentUserName ?? responsible.userName,
                ),
                userAvatarColor:
                  projectMemberByUserId.get(responsible.userId)
                    ?.userAvatarColor ?? null,
                userPosition: toStudioMemberPosition(
                  projectMemberByUserId.get(responsible.userId)?.userPosition,
                ),
                activeStudioMember: projectMemberByUserId.has(
                  responsible.userId,
                ),
              })),
            ],
          ]);
          const task = hydrateTasks(
            [
              {
                ...created,
                stageName: stage.name,
                stagePosition: stage.position,
              },
            ],
            responsibles,
          )[0]!;
          return { status: "created" as const, task };
        });
      } catch (error) {
        if (isTaskAssignmentUniqueViolation(error)) {
          return { status: "conflict" as const };
        }
        throw error;
      }
    },

    async update(values) {
      return db.transaction(async (transaction) => {
        const actor = await lockedActor(transaction, values.actor);
        if (!actor) return { status: "conflict" as const };
        const currentProject = await lockedProject(
          transaction,
          actor.organizationId,
          values.projectId,
        );
        if (!currentProject) return { status: "not_found" as const };
        if (currentProject.archivedAt) {
          return { status: "project_archived" as const };
        }
        const current = await currentTask(
          transaction,
          actor,
          values.projectId,
          values.taskId,
        );
        if (!current) return { status: "not_found" as const };
        if (current.archivedAt) return { status: "conflict" as const };

        const {
          automaticPlannedStartDate: automaticPlannedStartCandidate,
          ...requestedValues
        } = values.values;
        const hasQualifyingStatusTransition =
          requestedValues.status !== undefined &&
          requestedValues.status !== current.status &&
          (requestedValues.status === "in_progress" ||
            requestedValues.status === "completed");
        const requestedPlannedStartDate =
          requestedValues.plannedStartDate !== undefined
            ? requestedValues.plannedStartDate
            : current.plannedStartDate;
        const nextInternalDueDate =
          requestedValues.internalDueDate !== undefined
            ? requestedValues.internalDueDate
            : current.internalDueDate;
        const automaticPlannedStartDate =
          hasQualifyingStatusTransition &&
          requestedPlannedStartDate === null &&
          automaticPlannedStartCandidate
            ? clampCalendarDate(
                automaticPlannedStartCandidate,
                currentProject.startDate,
                nextInternalDueDate,
              )
            : null;
        const nextPlannedStartDate =
          requestedPlannedStartDate ?? automaticPlannedStartDate;
        if (
          hasInvalidTaskDates(
            currentProject.startDate,
            nextPlannedStartDate,
            nextInternalDueDate,
          )
        ) {
          return { status: "invalid_dates" as const };
        }

        let nextStage = {
          id: current.stageId,
          name: current.stageName,
          position: current.stagePosition,
        };
        let nextTaskPosition = current.position;
        if (
          requestedValues.stageId !== undefined &&
          requestedValues.stageId !== current.stageId
        ) {
          const stages = await transaction
            .select({
              id: projectStage.id,
              name: projectStage.name,
              position: projectStage.position,
            })
            .from(projectStage)
            .where(
              and(
                eq(projectStage.organizationId, actor.organizationId),
                eq(projectStage.projectId, values.projectId),
                eq(projectStage.id, requestedValues.stageId),
              ),
            )
            .limit(1);
          if (!stages[0]) return { status: "not_found" as const };
          nextStage = stages[0];
          const positions = await transaction
            .select({ value: max(projectTask.position) })
            .from(projectTask)
            .where(
              and(
                taskScope(actor.organizationId, values.projectId),
                eq(projectTask.stageId, nextStage.id),
              ),
            );
          nextTaskPosition = (positions[0]?.value ?? -1) + 1;
        }

        const nextTitle = requestedValues.title ?? current.title;
        const taskPatch = {
          ...requestedValues,
          ...(automaticPlannedStartDate
            ? { plannedStartDate: automaticPlannedStartDate }
            : {}),
        };
        const rows = await transaction
          .update(projectTask)
          .set({
            ...taskPatch,
            position: nextTaskPosition,
            updatedAt: new Date(),
          })
          .where(
            and(
              taskScope(actor.organizationId, values.projectId, values.taskId),
              isNull(projectTask.archivedAt),
            ),
          )
          .returning(taskBaseSelection);
        const updated = rows[0];
        if (!updated) return { status: "conflict" as const };

        const activities = [];
        const taskDetailChanges: Record<string, string | null> = {
          taskId: current.id,
          taskTitle: nextTitle,
        };
        if (
          requestedValues.title !== undefined &&
          requestedValues.title !== current.title
        ) {
          taskDetailChanges.previousTitle = current.title;
          taskDetailChanges.newTitle = requestedValues.title;
        }
        if (
          requestedValues.description !== undefined &&
          requestedValues.description !== current.description
        ) {
          taskDetailChanges.previousDescription = current.description;
          taskDetailChanges.newDescription = requestedValues.description;
        }
        if (Object.keys(taskDetailChanges).length > 2) {
          activities.push(
            activityValues(
              createId,
              actor,
              values.projectId,
              "task.details_changed",
              null,
              taskDetailChanges,
            ),
          );
        }

        const taskDateChanges: Record<string, string | null> = {
          taskId: current.id,
          taskTitle: nextTitle,
        };
        if (
          requestedValues.plannedStartDate !== undefined &&
          nextPlannedStartDate !== current.plannedStartDate
        ) {
          taskDateChanges.previousPlannedStartDate = current.plannedStartDate;
          taskDateChanges.newPlannedStartDate = nextPlannedStartDate;
        }
        if (
          requestedValues.internalDueDate !== undefined &&
          requestedValues.internalDueDate !== current.internalDueDate
        ) {
          taskDateChanges.previousInternalDueDate = current.internalDueDate;
          taskDateChanges.newInternalDueDate = requestedValues.internalDueDate;
        }
        if (Object.keys(taskDateChanges).length > 2) {
          activities.push(
            activityValues(
              createId,
              actor,
              values.projectId,
              "task.dates_changed",
              null,
              taskDateChanges,
            ),
          );
        }
        if (
          requestedValues.status !== undefined &&
          requestedValues.status !== current.status
        ) {
          activities.push(
            activityValues(
              createId,
              actor,
              values.projectId,
              "task.status_changed",
              null,
              {
                taskId: current.id,
                taskTitle: nextTitle,
                previousStatus: current.status,
                newStatus: requestedValues.status,
                ...(automaticPlannedStartDate
                  ? { automaticPlannedStartDate }
                  : {}),
              },
            ),
          );
        }
        if (nextStage.id !== current.stageId) {
          activities.push(
            activityValues(
              createId,
              actor,
              values.projectId,
              "task.stage_changed",
              null,
              {
                taskId: current.id,
                taskTitle: nextTitle,
                previousStageId: current.stageId,
                previousStageName: current.stageName,
                newStageId: nextStage.id,
                newStageName: nextStage.name,
              },
            ),
          );
        }
        if (activities.length > 0) {
          await transaction.insert(projectActivity).values(activities);
        }
        const task = await hydrateOne(transaction, {
          ...updated,
          stageName: nextStage.name,
          stagePosition: nextStage.position,
        });
        return { status: "updated" as const, task };
      });
    },

    async replaceResponsibles(values) {
      try {
        return await db.transaction(async (transaction) => {
          const actor = await lockedActor(transaction, values.actor);
          if (!actor) return { status: "conflict" as const };
          const currentProject = await lockedProject(
            transaction,
            actor.organizationId,
            values.projectId,
          );
          if (!currentProject) return { status: "not_found" as const };
          if (currentProject.archivedAt) {
            return { status: "project_archived" as const };
          }
          const current = await currentTask(
            transaction,
            actor,
            values.projectId,
            values.taskId,
          );
          if (!current) return { status: "not_found" as const };
          if (current.archivedAt) return { status: "conflict" as const };

          const projectMembers =
            values.responsibleUserIds.length === 0
              ? []
              : await transaction
                  .select(projectMemberSelection)
                  .from(projectAssignment)
                  .innerJoin(
                    member,
                    and(
                      eq(
                        member.organizationId,
                        projectAssignment.organizationId,
                      ),
                      eq(member.userId, projectAssignment.userId),
                    ),
                  )
                  .innerJoin(user, eq(user.id, member.userId))
                  .where(
                    and(
                      eq(
                        projectAssignment.organizationId,
                        actor.organizationId,
                      ),
                      eq(projectAssignment.projectId, values.projectId),
                      isNull(projectAssignment.endedAt),
                      inArray(
                        projectAssignment.userId,
                        values.responsibleUserIds,
                      ),
                    ),
                  )
                  .for("update");
          if (projectMembers.length !== values.responsibleUserIds.length) {
            return { status: "invalid_responsibles" as const };
          }
          const currentAssignments = await transaction
            .select(responsibleSnapshotSelection)
            .from(taskAssignment)
            .where(
              and(
                eq(taskAssignment.organizationId, actor.organizationId),
                eq(taskAssignment.projectId, values.projectId),
                eq(taskAssignment.taskId, values.taskId),
                isNull(taskAssignment.endedAt),
              ),
            )
            .for("update");

          const desiredIds = new Set(values.responsibleUserIds);
          const currentIds = new Set(
            currentAssignments.flatMap(({ userId }) =>
              userId === null ? [] : [userId],
            ),
          );
          const removed = currentAssignments.filter(
            ({ userId }) => userId !== null && !desiredIds.has(userId),
          );
          const added = projectMembers.filter(
            ({ userId }) => userId !== null && !currentIds.has(userId),
          );
          const endedAt = new Date();
          if (removed.length > 0) {
            await transaction
              .update(taskAssignment)
              .set({
                endedAt,
                endedByUserId: actor.userId,
                endedByNameSnapshot: actor.name,
                endReason: "task_unassigned",
              })
              .where(
                and(
                  eq(taskAssignment.organizationId, actor.organizationId),
                  eq(taskAssignment.projectId, values.projectId),
                  eq(taskAssignment.taskId, values.taskId),
                  inArray(
                    taskAssignment.id,
                    removed.map(({ assignmentId }) => assignmentId),
                  ),
                  isNull(taskAssignment.endedAt),
                ),
              );
          }

          const addedValues = added.map((responsible) => ({
            id: createId(),
            organizationId: actor.organizationId,
            projectId: values.projectId,
            taskId: values.taskId,
            userId: responsible.userId,
            userNameSnapshot: responsible.userName,
            userEmailSnapshot: responsible.userEmail,
            assignedByUserId: actor.userId,
            assignedByNameSnapshot: actor.name,
          }));
          if (addedValues.length > 0) {
            await transaction.insert(taskAssignment).values(addedValues);
          }

          const activities = [
            ...removed.map((responsible) =>
              activityValues(
                createId,
                actor,
                values.projectId,
                "task_assignment.removed",
                { userId: responsible.userId, name: responsible.userName },
                {
                  taskId: current.id,
                  taskTitle: current.title,
                  endReason: "task_unassigned",
                },
              ),
            ),
            ...addedValues.map((responsible) =>
              activityValues(
                createId,
                actor,
                values.projectId,
                "task_assignment.added",
                {
                  userId: responsible.userId,
                  name: responsible.userNameSnapshot,
                },
                { taskId: current.id, taskTitle: current.title },
              ),
            ),
          ];
          if (activities.length > 0) {
            await transaction.insert(projectActivity).values(activities);
          }
          const task = await hydrateOne(transaction, current);
          return { status: "updated" as const, task };
        });
      } catch (error) {
        if (isTaskAssignmentUniqueViolation(error)) {
          return { status: "conflict" as const };
        }
        throw error;
      }
    },

    async archive(values) {
      return changeArchivedState(values, "archived");
    },

    async restore(values) {
      return changeArchivedState(values, "active");
    },
  };
}
