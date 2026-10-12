import {
  and,
  asc,
  count,
  countDistinct,
  desc,
  eq,
  exists,
  isNotNull,
  isNull,
  inArray,
  min,
  or,
} from "drizzle-orm";

import type { createDatabase } from "../db/client";
import {
  accentInsensitiveLike,
  accentInsensitiveMatchesAny,
} from "../db/search-text";
import { member, user } from "../db/auth-schema";
import { client } from "../db/client-schema";
import {
  projectActivity,
  projectAssignment,
} from "../db/project-collaboration-schema";
import { projectEvent } from "../db/project-event-schema";
import { project } from "../db/project-schema";
import { projectStage } from "../db/project-stage-schema";
import { projectTask } from "../db/project-task-schema";
import { resolveUserAlias } from "../identity/user-alias";
import { isStudioMemberPosition } from "../identity/studio-member-position";
import { projectActivityValues } from "./project-activity";
import type { ProjectStore } from "./project-service";
import type {
  ProjectActor,
  ProjectListItemRecord,
  ProjectListFilters,
  ProjectRecord,
  ProjectValues,
} from "./project-types";

type Database = ReturnType<typeof createDatabase>["db"];

const projectSelection = {
  id: project.id,
  organizationId: project.organizationId,
  clientId: project.clientId,
  client: { id: client.id, name: client.name },
  name: project.name,
  type: project.type,
  status: project.status,
  startDate: project.startDate,
  endDate: project.endDate,
  internalReference: project.internalReference,
  description: project.description,
  archivedAt: project.archivedAt,
  createdAt: project.createdAt,
  updatedAt: project.updatedAt,
};

const lockedProjectSelection = {
  id: project.id,
  clientId: project.clientId,
  name: project.name,
  type: project.type,
  status: project.status,
  startDate: project.startDate,
  endDate: project.endDate,
  internalReference: project.internalReference,
  description: project.description,
  archivedAt: project.archivedAt,
};

function projectJoin() {
  return and(
    eq(project.clientId, client.id),
    eq(project.organizationId, client.organizationId),
  );
}

function projectWhere(
  db: Database,
  organizationId: string,
  filters: ProjectListFilters,
) {
  const search = filters.search
    ? accentInsensitiveMatchesAny(
        [project.name, client.name, project.internalReference],
        filters.search,
      )
    : undefined;
  const taskSearch = filters.search
    ? exists(
        db
          .select({ id: projectTask.id })
          .from(projectTask)
          .where(
            and(
              eq(projectTask.organizationId, organizationId),
              eq(projectTask.projectId, project.id),
              isNull(projectTask.archivedAt),
              accentInsensitiveLike(projectTask.title, filters.search),
            ),
          ),
      )
    : undefined;

  const combinedSearch = search && taskSearch ? or(search, taskSearch) : search;

  const lifecycle =
    filters.view === "archived"
      ? isNotNull(project.archivedAt)
      : filters.view === "current"
        ? and(
            isNull(project.archivedAt),
            inArray(project.status, ["draft", "active"]),
          )
        : filters.view === "completed"
          ? and(isNull(project.archivedAt), eq(project.status, "completed"))
          : isNull(project.archivedAt);

  return and(
    eq(project.organizationId, organizationId),
    combinedSearch,
    filters.types?.length ? inArray(project.type, filters.types) : undefined,
    filters.statuses?.length
      ? inArray(project.status, filters.statuses)
      : undefined,
    filters.clientIds?.length
      ? inArray(project.clientId, filters.clientIds)
      : undefined,
    ...(filters.memberUserIds ?? []).map((userId) =>
      exists(
        db
          .select({ id: projectAssignment.id })
          .from(projectAssignment)
          .where(
            and(
              eq(projectAssignment.organizationId, organizationId),
              eq(projectAssignment.projectId, project.id),
              eq(projectAssignment.userId, userId),
              isNull(projectAssignment.endedAt),
            ),
          ),
      ),
    ),
    lifecycle,
  );
}

function datesAreOrdered(values: ProjectValues) {
  return values.startDate <= values.endDate;
}

function projectOrder(filters: ProjectListFilters) {
  const orderBy =
    filters.orderBy ?? (filters.view === "archived" ? "archivedAt" : "endDate");
  const column = {
    endDate: project.endDate,
    startDate: project.startDate,
    name: project.name,
    archivedAt: project.archivedAt,
  }[orderBy];

  const direction =
    filters.order ??
    (filters.orderBy === undefined &&
    (filters.view === "archived" || filters.view === "completed")
      ? "desc"
      : "asc");
  return direction === "desc" ? desc(column) : asc(column);
}

function changedPair(
  details: Record<string, string | null>,
  key: string,
  previous: string | null,
  next: string | null,
) {
  if (previous === next) return;
  details[`previous${key}`] = previous;
  details[`new${key}`] = next;
}

export function createDrizzleProjectStore(
  db: Database,
  createId: () => string = () => crypto.randomUUID(),
): ProjectStore {
  async function hydrateProjectTeams(projects: ProjectRecord[]) {
    if (projects.length === 0) return [] as ProjectListItemRecord[];

    const assignments = await db
      .select({
        projectId: projectAssignment.projectId,
        userId: user.id,
        fullName: user.name,
        alias: user.alias,
        avatarColor: user.avatarColor,
        position: member.position,
        responsibility: projectAssignment.responsibility,
      })
      .from(projectAssignment)
      .innerJoin(
        member,
        and(
          eq(member.organizationId, projectAssignment.organizationId),
          eq(member.userId, projectAssignment.userId),
        ),
      )
      .innerJoin(user, eq(user.id, projectAssignment.userId))
      .where(
        and(
          eq(projectAssignment.organizationId, projects[0]!.organizationId),
          inArray(
            projectAssignment.projectId,
            projects.map(({ id }) => id),
          ),
          isNull(projectAssignment.endedAt),
        ),
      );

    const assignmentsByProject = new Map<string, typeof assignments>();
    for (const assignment of assignments) {
      const current = assignmentsByProject.get(assignment.projectId) ?? [];
      current.push(assignment);
      assignmentsByProject.set(assignment.projectId, current);
    }

    return projects.map((record) => {
      const activeTeam = (assignmentsByProject.get(record.id) ?? []).sort(
        (left, right) => {
          if (left.responsibility !== right.responsibility) {
            return left.responsibility === "responsible" ? -1 : 1;
          }
          return (
            left.fullName.localeCompare(right.fullName, "es") ||
            left.userId.localeCompare(right.userId)
          );
        },
      );

      return {
        ...record,
        team: {
          members: activeTeam.map((assignment) => ({
            userId: assignment.userId,
            fullName: assignment.fullName,
            alias: resolveUserAlias(assignment.alias, assignment.fullName),
            avatarColor: assignment.avatarColor,
            responsibility: assignment.responsibility,
            position: isStudioMemberPosition(assignment.position)
              ? assignment.position
              : null,
          })),
          total: activeTeam.length,
        },
      };
    }) as ProjectListItemRecord[];
  }

  async function loadProject(organizationId: string, projectId: string) {
    const rows = await db
      .select(projectSelection)
      .from(project)
      .innerJoin(client, projectJoin())
      .where(
        and(
          eq(project.organizationId, organizationId),
          eq(project.id, projectId),
        ),
      )
      .limit(1);

    return rows[0] ?? null;
  }

  async function changeArchiveState(
    actor: ProjectActor,
    projectId: string,
    mode: "archive" | "restore",
  ) {
    const result = await db.transaction(async (transaction) => {
      const actors = await transaction
        .select({ userId: member.userId, name: user.name })
        .from(member)
        .innerJoin(user, eq(member.userId, user.id))
        .where(
          and(
            eq(member.userId, actor.userId),
            eq(member.organizationId, actor.organizationId),
          ),
        )
        .limit(1)
        .for("share");
      const transactionActor = actors[0];
      if (!transactionActor) return { status: "forbidden" as const };

      const projects = await transaction
        .select({ id: project.id, archivedAt: project.archivedAt })
        .from(project)
        .where(
          and(
            eq(project.organizationId, actor.organizationId),
            eq(project.id, projectId),
          ),
        )
        .limit(1)
        .for("update");
      const current = projects[0];
      if (!current) return { status: "not_found" as const };
      if (
        (mode === "archive" && current.archivedAt !== null) ||
        (mode === "restore" && current.archivedAt === null)
      ) {
        return { status: "archive_conflict" as const };
      }

      const changedAt = new Date();
      await transaction
        .update(project)
        .set({
          archivedAt: mode === "archive" ? changedAt : null,
          updatedAt: changedAt,
        })
        .where(
          and(
            eq(project.organizationId, actor.organizationId),
            eq(project.id, projectId),
          ),
        );
      await transaction.insert(projectActivity).values(
        projectActivityValues({
          id: createId(),
          organizationId: actor.organizationId,
          projectId,
          type: mode === "archive" ? "project.archived" : "project.restored",
          actor: transactionActor,
          details: {},
          createdAt: changedAt,
        }),
      );
      return { status: "updated" as const };
    });

    if (result.status !== "updated") return result;
    const changed = await loadProject(actor.organizationId, projectId);
    if (!changed) throw new Error("Changed project could not be reloaded");
    return { status: "updated" as const, project: changed };
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
      const where = projectWhere(db, organizationId, filters);
      const [records, totals] = await Promise.all([
        db
          .select(projectSelection)
          .from(project)
          .innerJoin(client, projectJoin())
          .where(where)
          .orderBy(projectOrder(filters), asc(project.name), asc(project.id))
          .limit(filters.pageSize)
          .offset((filters.page - 1) * filters.pageSize),
        db
          .select({ value: count() })
          .from(project)
          .innerJoin(client, projectJoin())
          .where(where),
      ]);

      const projects = await hydrateProjectTeams(records);
      return { projects, total: totals[0]?.value ?? 0 };
    },

    async listGroupedByClient(organizationId, filters) {
      const where = projectWhere(db, organizationId, filters);
      const [clientPage, totals] = await Promise.all([
        db
          .selectDistinct({ id: client.id, name: client.name })
          .from(project)
          .innerJoin(client, projectJoin())
          .where(where)
          .orderBy(asc(client.name), asc(client.id))
          .limit(filters.pageSize)
          .offset((filters.page - 1) * filters.pageSize),
        db
          .select({
            clientTotal: countDistinct(client.id),
            projectTotal: count(project.id),
          })
          .from(project)
          .innerJoin(client, projectJoin())
          .where(where),
      ]);

      const total = totals[0] ?? { clientTotal: 0, projectTotal: 0 };
      if (clientPage.length === 0) {
        return { groups: [], ...total };
      }

      const records = await db
        .select(projectSelection)
        .from(project)
        .innerJoin(client, projectJoin())
        .where(
          and(
            where,
            inArray(
              client.id,
              clientPage.map(({ id }) => id),
            ),
          ),
        )
        .orderBy(
          asc(client.name),
          asc(client.id),
          projectOrder(filters),
          asc(project.name),
          asc(project.id),
        );

      const projects = await hydrateProjectTeams(records);

      const projectsByClient = new Map<string, typeof projects>();
      for (const record of projects) {
        const group = projectsByClient.get(record.client.id) ?? [];
        group.push(record);
        projectsByClient.set(record.client.id, group);
      }

      return {
        groups: clientPage.map((clientRecord) => ({
          client: clientRecord,
          projects: projectsByClient.get(clientRecord.id) ?? [],
        })),
        ...total,
      };
    },

    get: loadProject,

    async create(
      actor,
      projectId,
      values,
      initialStages,
      initialLegalEvents,
      initialAssignments,
    ) {
      const result = await db.transaction(async (transaction) => {
        const actors = await transaction
          .select({ userId: member.userId, name: user.name })
          .from(member)
          .innerJoin(user, eq(member.userId, user.id))
          .where(
            and(
              eq(member.userId, actor.userId),
              eq(member.organizationId, actor.organizationId),
            ),
          )
          .limit(1)
          .for("share");
        const transactionActor = actors[0];
        if (!transactionActor) return { status: "forbidden" as const };

        const clients = await transaction
          .select({ id: client.id })
          .from(client)
          .where(
            and(
              eq(client.organizationId, actor.organizationId),
              eq(client.id, values.clientId),
            ),
          )
          .limit(1)
          .for("share");
        if (!clients[0]) return { status: "client_not_found" as const };

        const requestedUserIds = initialAssignments.map(
          (assignment) => assignment.userId,
        );
        const uniqueRequestedUserIds = [...new Set(requestedUserIds)];
        const assignmentMembers =
          uniqueRequestedUserIds.length === 0
            ? []
            : await transaction
                .select({
                  userId: member.userId,
                  name: user.name,
                  email: user.email,
                })
                .from(member)
                .innerJoin(user, eq(member.userId, user.id))
                .where(
                  and(
                    eq(member.organizationId, actor.organizationId),
                    inArray(member.userId, uniqueRequestedUserIds),
                  ),
                )
                .orderBy(asc(member.id))
                .for("share");
        if (
          uniqueRequestedUserIds.length !== initialAssignments.length ||
          assignmentMembers.length !== uniqueRequestedUserIds.length
        ) {
          return { status: "member_not_found" as const };
        }

        await transaction.insert(project).values({
          id: projectId,
          organizationId: actor.organizationId,
          ...values,
        });

        const eventRecords = initialLegalEvents.map((event) => ({
          id: createId(),
          organizationId: actor.organizationId,
          projectId,
          title: event.title,
          type: "legal" as const,
          date: event.date,
          description: event.description,
          createdByUserId: transactionActor.userId,
        }));
        if (eventRecords.length > 0) {
          await transaction.insert(projectEvent).values(eventRecords);
        }

        if (initialStages.length > 0) {
          await transaction.insert(projectStage).values(
            initialStages.map((stage) => ({
              ...stage,
              organizationId: actor.organizationId,
              projectId,
            })),
          );
        }

        const createdAt = new Date();
        const assignmentMemberByUserId = new Map(
          assignmentMembers.map((assignmentMember) => [
            assignmentMember.userId,
            assignmentMember,
          ]),
        );
        const assignmentRecords = initialAssignments.map((assignment) => {
          const assignmentMember = assignmentMemberByUserId.get(
            assignment.userId,
          )!;
          return {
            id: createId(),
            organizationId: actor.organizationId,
            projectId,
            userId: assignmentMember.userId,
            userNameSnapshot: assignmentMember.name,
            userEmailSnapshot: assignmentMember.email,
            responsibility: assignment.responsibility,
            assignedByUserId: transactionActor.userId,
            assignedByNameSnapshot: transactionActor.name,
            assignedAt: createdAt,
          };
        });
        if (assignmentRecords.length > 0) {
          await transaction.insert(projectAssignment).values(assignmentRecords);
        }
        await transaction.insert(projectActivity).values([
          projectActivityValues({
            id: createId(),
            organizationId: actor.organizationId,
            projectId,
            type: "project.created",
            actor: transactionActor,
            details: { projectName: values.name },
            createdAt,
          }),
          ...eventRecords.map((event) =>
            projectActivityValues({
              id: createId(),
              organizationId: actor.organizationId,
              projectId,
              type: "project.event_created",
              actor: transactionActor,
              details: {
                eventId: event.id,
                title: event.title,
                type: "legal",
                date: event.date,
                description: event.description,
              },
              createdAt,
            }),
          ),
          ...assignmentRecords.map((assignment) =>
            projectActivityValues({
              id: createId(),
              organizationId: actor.organizationId,
              projectId,
              type: "project_assignment.added",
              actor: transactionActor,
              subject: {
                userId: assignment.userId!,
                name: assignment.userNameSnapshot,
              },
              details: {
                assignmentId: assignment.id,
                responsibility: assignment.responsibility,
              },
              createdAt,
            }),
          ),
        ]);
        return { status: "created" as const };
      });

      if (result.status !== "created") return result;
      const created = await loadProject(actor.organizationId, projectId);
      if (!created) throw new Error("Created project could not be reloaded");
      return { status: "created" as const, project: created };
    },

    async update(actor, projectId, values) {
      const result = await db.transaction(async (transaction) => {
        const actors = await transaction
          .select({ userId: member.userId, name: user.name })
          .from(member)
          .innerJoin(user, eq(member.userId, user.id))
          .where(
            and(
              eq(member.userId, actor.userId),
              eq(member.organizationId, actor.organizationId),
            ),
          )
          .limit(1)
          .for("share");
        const transactionActor = actors[0];
        if (!transactionActor) return { status: "forbidden" as const };

        const projects = await transaction
          .select(lockedProjectSelection)
          .from(project)
          .where(
            and(
              eq(project.organizationId, actor.organizationId),
              eq(project.id, projectId),
            ),
          )
          .limit(1)
          .for("update");
        const current = projects[0];
        if (!current) return { status: "not_found" as const };
        if (current.archivedAt !== null) {
          return { status: "project_archived" as const };
        }

        const next: ProjectValues = {
          clientId: values.clientId ?? current.clientId,
          name: values.name ?? current.name,
          type: values.type ?? current.type,
          status: values.status ?? current.status,
          startDate: values.startDate ?? current.startDate,
          endDate: values.endDate ?? current.endDate,
          internalReference:
            values.internalReference !== undefined
              ? values.internalReference
              : current.internalReference,
          description:
            values.description !== undefined
              ? values.description
              : current.description,
        };
        if (!datesAreOrdered(next)) return { status: "invalid_dates" as const };

        if (next.startDate !== current.startDate) {
          const earliestStarts = await transaction
            .select({ value: min(projectTask.plannedStartDate) })
            .from(projectTask)
            .where(
              and(
                eq(projectTask.organizationId, actor.organizationId),
                eq(projectTask.projectId, projectId),
                isNull(projectTask.archivedAt),
              ),
            );
          const earliestStart = earliestStarts[0]?.value;
          if (earliestStart && next.startDate > earliestStart) {
            return { status: "invalid_task_start" as const };
          }
          const earliestEvents = await transaction
            .select({ value: min(projectEvent.date) })
            .from(projectEvent)
            .where(
              and(
                eq(projectEvent.organizationId, actor.organizationId),
                eq(projectEvent.projectId, projectId),
              ),
            );
          const earliestEvent = earliestEvents[0]?.value;
          if (earliestEvent && next.startDate > earliestEvent) {
            return { status: "invalid_event_start" as const };
          }
        }

        const clientIds = [...new Set([current.clientId, next.clientId])];
        const clients = await transaction
          .select({ id: client.id, name: client.name })
          .from(client)
          .where(
            and(
              eq(client.organizationId, actor.organizationId),
              or(...clientIds.map((clientId) => eq(client.id, clientId))),
            ),
          );
        const clientNames = new Map(
          clients.map((candidate) => [candidate.id, candidate.name]),
        );
        if (!clientNames.has(next.clientId)) {
          return { status: "client_not_found" as const };
        }

        const detailChanges: Record<string, string | null> = {};
        changedPair(detailChanges, "Name", current.name, next.name);
        if (current.clientId !== next.clientId) {
          changedPair(
            detailChanges,
            "ClientId",
            current.clientId,
            next.clientId,
          );
          changedPair(
            detailChanges,
            "ClientName",
            clientNames.get(current.clientId) ?? null,
            clientNames.get(next.clientId) ?? null,
          );
        }
        changedPair(detailChanges, "Type", current.type, next.type);
        changedPair(
          detailChanges,
          "InternalReference",
          current.internalReference,
          next.internalReference,
        );
        changedPair(
          detailChanges,
          "Description",
          current.description,
          next.description,
        );

        const dateChanges: Record<string, string | null> = {};
        changedPair(
          dateChanges,
          "StartDate",
          current.startDate,
          next.startDate,
        );
        changedPair(dateChanges, "EndDate", current.endDate, next.endDate);

        const statusChanges: Record<string, string | null> = {};
        changedPair(statusChanges, "Status", current.status, next.status);
        const activities = [detailChanges, dateChanges, statusChanges].filter(
          (details) => Object.keys(details).length > 0,
        );
        if (activities.length === 0) return { status: "unchanged" as const };

        const changedAt = new Date();
        await transaction
          .update(project)
          .set({
            ...values,
            endDate: next.endDate,
            updatedAt: changedAt,
          })
          .where(
            and(
              eq(project.organizationId, actor.organizationId),
              eq(project.id, projectId),
            ),
          );

        const typedActivities = [
          ["project.details_changed", detailChanges],
          ["project.dates_changed", dateChanges],
          ["project.status_changed", statusChanges],
        ] as const;
        await transaction.insert(projectActivity).values(
          typedActivities
            .filter(([, details]) => Object.keys(details).length > 0)
            .map(([type, details]) =>
              projectActivityValues({
                id: createId(),
                organizationId: actor.organizationId,
                projectId,
                type,
                actor: transactionActor,
                details,
                createdAt: changedAt,
              }),
            ),
        );
        return { status: "updated" as const };
      });

      if (result.status !== "updated" && result.status !== "unchanged") {
        return result;
      }
      const changed = await loadProject(actor.organizationId, projectId);
      if (!changed) throw new Error("Updated project could not be reloaded");
      return { status: result.status, project: changed };
    },

    archive(actor, projectId) {
      return changeArchiveState(actor, projectId, "archive");
    },

    restore(actor, projectId) {
      return changeArchiveState(actor, projectId, "restore");
    },
  };
}
