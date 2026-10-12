import { relations, sql } from "drizzle-orm";
import {
  date,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import { organization, user } from "./auth-schema";
import { project } from "./project-schema";
import { projectStage } from "./project-stage-schema";

export const projectTaskStatus = pgEnum("project_task_status", [
  "pending",
  "in_progress",
  "blocked",
  "completed",
]);

export const taskAssignmentEndReason = pgEnum("task_assignment_end_reason", [
  "task_unassigned",
  "project_unassigned",
  "organization_removed",
]);

export const projectTask = pgTable(
  "project_task",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    projectId: text("project_id")
      .notNull()
      .references(() => project.id, { onDelete: "cascade" }),
    stageId: text("stage_id")
      .notNull()
      .references(() => projectStage.id, { onDelete: "restrict" }),
    title: text("title").notNull(),
    description: text("description"),
    status: projectTaskStatus("status").default("pending").notNull(),
    plannedStartDate: date("planned_start_date", { mode: "string" }),
    internalDueDate: date("internal_due_date", { mode: "string" }),
    position: integer("position").notNull(),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    archivedByUserId: text("archived_by_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    archivedByNameSnapshot: text("archived_by_name_snapshot"),
    createdByUserId: text("created_by_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    createdByNameSnapshot: text("created_by_name_snapshot").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("project_task_active_order_idx")
      .on(table.organizationId, table.projectId, table.stageId, table.position)
      .where(sql`${table.archivedAt} is null`),
    index("project_task_archived_order_idx")
      .on(table.organizationId, table.projectId, table.stageId, table.position)
      .where(sql`${table.archivedAt} is not null`),
    index("project_task_stage_reference_idx").on(
      table.organizationId,
      table.projectId,
      table.stageId,
    ),
  ],
);

export const taskAssignment = pgTable(
  "task_assignment",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    projectId: text("project_id")
      .notNull()
      .references(() => project.id, { onDelete: "cascade" }),
    taskId: text("task_id")
      .notNull()
      .references(() => projectTask.id, { onDelete: "cascade" }),
    userId: text("user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    userNameSnapshot: text("user_name_snapshot").notNull(),
    userEmailSnapshot: text("user_email_snapshot").notNull(),
    assignedByUserId: text("assigned_by_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    assignedByNameSnapshot: text("assigned_by_name_snapshot").notNull(),
    assignedAt: timestamp("assigned_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    endedAt: timestamp("ended_at", { withTimezone: true }),
    endedByUserId: text("ended_by_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    endedByNameSnapshot: text("ended_by_name_snapshot"),
    endReason: taskAssignmentEndReason("end_reason"),
  },
  (table) => [
    uniqueIndex("task_assignment_active_user_unique")
      .on(table.taskId, table.userId)
      .where(sql`${table.endedAt} is null`),
    index("task_assignment_task_active_idx").on(
      table.organizationId,
      table.projectId,
      table.taskId,
      table.endedAt,
    ),
    index("task_assignment_task_history_idx").on(
      table.organizationId,
      table.projectId,
      table.taskId,
      table.endedAt,
    ),
  ],
);

export const projectTaskRelations = relations(projectTask, ({ one, many }) => ({
  organization: one(organization, {
    fields: [projectTask.organizationId],
    references: [organization.id],
  }),
  project: one(project, {
    fields: [projectTask.projectId],
    references: [project.id],
  }),
  stage: one(projectStage, {
    fields: [projectTask.stageId],
    references: [projectStage.id],
  }),
  assignments: many(taskAssignment),
}));

export const taskAssignmentRelations = relations(taskAssignment, ({ one }) => ({
  organization: one(organization, {
    fields: [taskAssignment.organizationId],
    references: [organization.id],
  }),
  project: one(project, {
    fields: [taskAssignment.projectId],
    references: [project.id],
  }),
  task: one(projectTask, {
    fields: [taskAssignment.taskId],
    references: [projectTask.id],
  }),
  user: one(user, {
    fields: [taskAssignment.userId],
    references: [user.id],
  }),
}));
