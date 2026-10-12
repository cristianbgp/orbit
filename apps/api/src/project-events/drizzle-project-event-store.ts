import { and, asc, count, eq } from "drizzle-orm";

import { member, user } from "../db/auth-schema";
import type { createDatabase } from "../db/client";
import { projectActivity } from "../db/project-collaboration-schema";
import { projectEvent } from "../db/project-event-schema";
import { project } from "../db/project-schema";
import { projectActivityValues } from "../projects/project-activity";
import type { ProjectEventStore } from "./project-event-service";
import type {
  ProjectEventActor,
  ProjectEventRecord,
} from "./project-event-types";

type Database = ReturnType<typeof createDatabase>["db"];

const eventSelection = {
  id: projectEvent.id,
  organizationId: projectEvent.organizationId,
  projectId: projectEvent.projectId,
  title: projectEvent.title,
  type: projectEvent.type,
  date: projectEvent.date,
  description: projectEvent.description,
  createdByUserId: projectEvent.createdByUserId,
  createdAt: projectEvent.createdAt,
  updatedAt: projectEvent.updatedAt,
};

function details(event: ProjectEventRecord) {
  return {
    eventId: event.id,
    title: event.title,
    type: event.type,
    date: event.date,
    description: event.description,
  };
}

export function createDrizzleProjectEventStore(
  db: Database,
  createId: () => string = () => crypto.randomUUID(),
): ProjectEventStore {
  async function actorInTransaction(
    transaction: Parameters<Parameters<Database["transaction"]>[0]>[0],
    actor: ProjectEventActor,
  ) {
    const rows = await transaction
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

    async list(organizationId, projectId, pagination) {
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
      if (!projects[0]) return null;

      const [events, totals] = await Promise.all([
        db
          .select(eventSelection)
          .from(projectEvent)
          .where(
            and(
              eq(projectEvent.organizationId, organizationId),
              eq(projectEvent.projectId, projectId),
            ),
          )
          .orderBy(asc(projectEvent.date), asc(projectEvent.id))
          .limit(pagination.pageSize)
          .offset((pagination.page - 1) * pagination.pageSize),
        db
          .select({ value: count() })
          .from(projectEvent)
          .where(
            and(
              eq(projectEvent.organizationId, organizationId),
              eq(projectEvent.projectId, projectId),
            ),
          ),
      ]);
      return { events, total: totals[0]?.value ?? 0 };
    },

    async create(actor, projectId, eventId, values) {
      const result = await db.transaction(async (transaction) => {
        const transactionActor = await actorInTransaction(transaction, actor);
        if (!transactionActor) return { status: "forbidden" as const };
        const projects = await transaction
          .select({
            startDate: project.startDate,
            archivedAt: project.archivedAt,
          })
          .from(project)
          .where(
            and(
              eq(project.organizationId, actor.organizationId),
              eq(project.id, projectId),
            ),
          )
          .limit(1)
          .for("update");
        const currentProject = projects[0];
        if (!currentProject) return { status: "not_found" as const };
        if (currentProject.archivedAt) {
          return { status: "project_archived" as const };
        }
        if (values.date < currentProject.startDate) {
          return { status: "invalid_date" as const };
        }
        const createdAt = new Date();
        await transaction.insert(projectEvent).values({
          id: eventId,
          organizationId: actor.organizationId,
          projectId,
          ...values,
          createdByUserId: transactionActor.userId,
          createdAt,
          updatedAt: createdAt,
        });
        const event: ProjectEventRecord = {
          id: eventId,
          organizationId: actor.organizationId,
          projectId,
          ...values,
          createdByUserId: transactionActor.userId,
          createdAt,
          updatedAt: createdAt,
        };
        await transaction.insert(projectActivity).values(
          projectActivityValues({
            id: createId(),
            organizationId: actor.organizationId,
            projectId,
            type: "project.event_created",
            actor: transactionActor,
            details: details(event),
            createdAt,
          }),
        );
        return { status: "created" as const, event };
      });
      return result;
    },

    async update(actor, projectId, eventId, values) {
      const result = await db.transaction(async (transaction) => {
        const transactionActor = await actorInTransaction(transaction, actor);
        if (!transactionActor) return { status: "forbidden" as const };
        const projects = await transaction
          .select({
            startDate: project.startDate,
            archivedAt: project.archivedAt,
          })
          .from(project)
          .where(
            and(
              eq(project.organizationId, actor.organizationId),
              eq(project.id, projectId),
            ),
          )
          .limit(1)
          .for("update");
        const currentProject = projects[0];
        if (!currentProject) return { status: "not_found" as const };
        if (currentProject.archivedAt) {
          return { status: "project_archived" as const };
        }
        const rows = await transaction
          .select(eventSelection)
          .from(projectEvent)
          .where(
            and(
              eq(projectEvent.organizationId, actor.organizationId),
              eq(projectEvent.projectId, projectId),
              eq(projectEvent.id, eventId),
            ),
          )
          .limit(1)
          .for("update");
        const current = rows[0];
        if (!current) return { status: "not_found" as const };
        const next = { ...current, ...values };
        if (next.date < currentProject.startDate) {
          return { status: "invalid_date" as const };
        }
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
          .update(projectEvent)
          .set({ ...values, updatedAt })
          .where(eq(projectEvent.id, eventId));
        const event = { ...next, updatedAt };
        await transaction.insert(projectActivity).values(
          projectActivityValues({
            id: createId(),
            organizationId: actor.organizationId,
            projectId,
            type: "project.event_updated",
            actor: transactionActor,
            details: {
              ...details(current),
              newTitle: event.title,
              newType: event.type,
              newDate: event.date,
              newDescription: event.description,
            },
            createdAt: updatedAt,
          }),
        );
        return { status: "updated" as const, event };
      });
      return result;
    },

    async remove(actor, projectId, eventId) {
      return db.transaction(async (transaction) => {
        const transactionActor = await actorInTransaction(transaction, actor);
        if (!transactionActor) return { status: "forbidden" as const };
        const projects = await transaction
          .select({ archivedAt: project.archivedAt })
          .from(project)
          .where(
            and(
              eq(project.organizationId, actor.organizationId),
              eq(project.id, projectId),
            ),
          )
          .limit(1)
          .for("update");
        const currentProject = projects[0];
        if (!currentProject) return { status: "not_found" as const };
        if (currentProject.archivedAt) {
          return { status: "project_archived" as const };
        }
        const rows = await transaction
          .select(eventSelection)
          .from(projectEvent)
          .where(
            and(
              eq(projectEvent.organizationId, actor.organizationId),
              eq(projectEvent.projectId, projectId),
              eq(projectEvent.id, eventId),
            ),
          )
          .limit(1)
          .for("update");
        const current = rows[0];
        if (!current) return { status: "not_found" as const };
        await transaction
          .delete(projectEvent)
          .where(eq(projectEvent.id, eventId));
        await transaction.insert(projectActivity).values(
          projectActivityValues({
            id: createId(),
            organizationId: actor.organizationId,
            projectId,
            type: "project.event_deleted",
            actor: transactionActor,
            details: details(current),
          }),
        );
        return { status: "removed" as const };
      });
    },
  };
}
