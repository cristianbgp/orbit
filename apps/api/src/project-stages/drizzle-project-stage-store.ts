import { and, asc, eq, max } from "drizzle-orm";

import { member, user } from "../db/auth-schema";
import type { createDatabase } from "../db/client";
import { projectActivity } from "../db/project-collaboration-schema";
import { project } from "../db/project-schema";
import { projectStage } from "../db/project-stage-schema";
import { projectTask } from "../db/project-task-schema";
import { projectActivityValues } from "../projects/project-activity";
import type { ProjectActor } from "../projects/project-types";
import type { ProjectStageStore } from "./project-stage-service";

type Database = ReturnType<typeof createDatabase>["db"];

const stageSelection = {
  id: projectStage.id,
  organizationId: projectStage.organizationId,
  projectId: projectStage.projectId,
  name: projectStage.name,
  description: projectStage.description,
  position: projectStage.position,
  createdAt: projectStage.createdAt,
  updatedAt: projectStage.updatedAt,
};

function stageWhere(
  organizationId: string,
  projectId: string,
  stageId?: string,
) {
  return and(
    eq(projectStage.organizationId, organizationId),
    eq(projectStage.projectId, projectId),
    stageId ? eq(projectStage.id, stageId) : undefined,
  );
}

export function createDrizzleProjectStageStore(
  db: Database,
  createId: () => string = () => crypto.randomUUID(),
): ProjectStageStore {
  async function lockActor(
    transaction: Parameters<Parameters<Database["transaction"]>[0]>[0],
    actor: ProjectActor,
  ) {
    const rows = await transaction
      .select({ userId: user.id, name: user.name })
      .from(member)
      .innerJoin(user, eq(member.userId, user.id))
      .where(
        and(
          eq(member.userId, actor.userId),
          eq(member.organizationId, actor.organizationId),
        ),
      )
      .limit(1)
      .for("update");
    return rows[0] ?? null;
  }

  async function lockProject(
    transaction: Parameters<Parameters<Database["transaction"]>[0]>[0],
    organizationId: string,
    projectId: string,
  ) {
    const rows = await transaction
      .select({ id: project.id, archivedAt: project.archivedAt })
      .from(project)
      .where(
        and(
          eq(project.id, projectId),
          eq(project.organizationId, organizationId),
        ),
      )
      .limit(1)
      .for("update");
    return rows[0] ?? null;
  }

  return {
    async getMembershipRole(userId, organizationId) {
      const rows = await db
        .select({ role: member.role })
        .from(member)
        .where(
          and(
            eq(member.userId, userId),
            eq(member.organizationId, organizationId),
          ),
        )
        .limit(1);
      return rows[0]?.role ?? null;
    },

    async projectExists(organizationId, projectId) {
      const rows = await db
        .select({ id: project.id })
        .from(project)
        .where(
          and(
            eq(project.organizationId, organizationId),
            eq(project.id, projectId),
          ),
        )
        .limit(1);
      return rows.length > 0;
    },

    async list(organizationId, projectId) {
      return db
        .select(stageSelection)
        .from(projectStage)
        .where(stageWhere(organizationId, projectId))
        .orderBy(asc(projectStage.position), asc(projectStage.id));
    },

    async create(actor, projectId, values) {
      return db.transaction(async (transaction) => {
        const transactionActor = await lockActor(transaction, actor);
        if (!transactionActor) return { status: "not_found" as const };
        const currentProject = await lockProject(
          transaction,
          actor.organizationId,
          projectId,
        );
        if (!currentProject) return { status: "not_found" as const };
        if (currentProject.archivedAt) {
          return { status: "project_archived" as const };
        }
        const positions = await transaction
          .select({ value: max(projectStage.position) })
          .from(projectStage)
          .where(stageWhere(actor.organizationId, projectId));
        const position = (positions[0]?.value ?? -1) + 1;
        const rows = await transaction
          .insert(projectStage)
          .values({
            ...values,
            organizationId: actor.organizationId,
            projectId,
            position,
          })
          .returning(stageSelection);
        const created = rows[0]!;
        await transaction.insert(projectActivity).values(
          projectActivityValues({
            id: createId(),
            organizationId: actor.organizationId,
            projectId,
            type: "project.stage_created",
            actor: transactionActor,
            details: {
              stageId: created.id,
              stageName: created.name,
              stageDescription: created.description,
              stagePosition: String(created.position),
            },
          }),
        );
        return created;
      });
    },

    async update(actor, projectId, stageId, values) {
      return db.transaction(async (transaction) => {
        const transactionActor = await lockActor(transaction, actor);
        if (!transactionActor) return null;
        const currentProject = await lockProject(
          transaction,
          actor.organizationId,
          projectId,
        );
        if (!currentProject) return null;
        if (currentProject.archivedAt) {
          return { status: "project_archived" as const };
        }
        const currentRows = await transaction
          .select(stageSelection)
          .from(projectStage)
          .where(stageWhere(actor.organizationId, projectId, stageId))
          .limit(1)
          .for("update");
        const current = currentRows[0];
        if (!current) return null;
        const nextName = values.name ?? current.name;
        const nextDescription =
          values.description !== undefined
            ? values.description
            : current.description;
        const details: Record<string, string | null> = {
          stageId: current.id,
          stageName: nextName,
        };
        if (nextName !== current.name) {
          details.previousName = current.name;
          details.newName = nextName;
        }
        if (nextDescription !== current.description) {
          details.previousDescription = current.description;
          details.newDescription = nextDescription;
        }
        if (Object.keys(details).length === 2) return current;

        const changedAt = new Date();
        const rows = await transaction
          .update(projectStage)
          .set({ ...values, updatedAt: changedAt })
          .where(stageWhere(actor.organizationId, projectId, stageId))
          .returning(stageSelection);
        if (rows[0]) {
          await transaction.insert(projectActivity).values(
            projectActivityValues({
              id: createId(),
              organizationId: actor.organizationId,
              projectId,
              type: "project.stage_details_changed",
              actor: transactionActor,
              details,
              createdAt: changedAt,
            }),
          );
        }
        return rows[0] ?? null;
      });
    },

    async reorder(actor, projectId, stageIds) {
      return db.transaction(async (transaction) => {
        const transactionActor = await lockActor(transaction, actor);
        if (!transactionActor) return null;
        const currentProject = await lockProject(
          transaction,
          actor.organizationId,
          projectId,
        );
        if (!currentProject) return null;
        if (currentProject.archivedAt) {
          return { status: "project_archived" as const };
        }
        const current = await transaction
          .select(stageSelection)
          .from(projectStage)
          .where(stageWhere(actor.organizationId, projectId))
          .orderBy(asc(projectStage.position), asc(projectStage.id));
        const currentIds = new Set(current.map(({ id }) => id));
        if (
          current.length !== stageIds.length ||
          new Set(stageIds).size !== stageIds.length ||
          !stageIds.every((id) => currentIds.has(id))
        ) {
          return null;
        }
        if (current.every(({ id }, index) => id === stageIds[index])) {
          return current;
        }
        const currentById = new Map(current.map((stage) => [stage.id, stage]));
        const changedAt = new Date();
        for (const [position, stageId] of stageIds.entries()) {
          await transaction
            .update(projectStage)
            .set({ position, updatedAt: changedAt })
            .where(stageWhere(actor.organizationId, projectId, stageId));
        }
        const reordered = await transaction
          .select(stageSelection)
          .from(projectStage)
          .where(stageWhere(actor.organizationId, projectId))
          .orderBy(asc(projectStage.position), asc(projectStage.id));
        await transaction.insert(projectActivity).values(
          projectActivityValues({
            id: createId(),
            organizationId: actor.organizationId,
            projectId,
            type: "project.stages_reordered",
            actor: transactionActor,
            details: {
              previousOrder: JSON.stringify(
                current.map(({ id, name }) => ({ id, name })),
              ),
              newOrder: JSON.stringify(
                stageIds.map((id) => ({ id, name: currentById.get(id)!.name })),
              ),
            },
            createdAt: changedAt,
          }),
        );
        return reordered;
      });
    },

    async remove(actor, projectId, stageId) {
      return db.transaction(async (transaction) => {
        const transactionActor = await lockActor(transaction, actor);
        if (!transactionActor) return "not_found";
        const currentProject = await lockProject(
          transaction,
          actor.organizationId,
          projectId,
        );
        if (!currentProject) return "not_found";
        if (currentProject.archivedAt) return "project_archived";
        const currentRows = await transaction
          .select(stageSelection)
          .from(projectStage)
          .where(stageWhere(actor.organizationId, projectId, stageId))
          .limit(1)
          .for("update");
        const current = currentRows[0];
        if (!current) return "not_found";
        const tasks = await transaction
          .select({ id: projectTask.id })
          .from(projectTask)
          .where(
            and(
              eq(projectTask.organizationId, actor.organizationId),
              eq(projectTask.projectId, projectId),
              eq(projectTask.stageId, stageId),
            ),
          )
          .limit(1);
        if (tasks.length > 0) return "in_use";

        const deleted = await transaction
          .delete(projectStage)
          .where(stageWhere(actor.organizationId, projectId, stageId))
          .returning({ id: projectStage.id });
        if (deleted.length === 0) return "not_found";
        const remaining = await transaction
          .select({ id: projectStage.id })
          .from(projectStage)
          .where(stageWhere(actor.organizationId, projectId))
          .orderBy(asc(projectStage.position), asc(projectStage.id));
        for (const [position, { id }] of remaining.entries()) {
          await transaction
            .update(projectStage)
            .set({ position, updatedAt: new Date() })
            .where(stageWhere(actor.organizationId, projectId, id));
        }
        await transaction.insert(projectActivity).values(
          projectActivityValues({
            id: createId(),
            organizationId: actor.organizationId,
            projectId,
            type: "project.stage_deleted",
            actor: transactionActor,
            details: {
              stageId: current.id,
              stageName: current.name,
              stageDescription: current.description,
              stagePosition: String(current.position),
            },
          }),
        );
        return "removed";
      });
    },
  };
}
