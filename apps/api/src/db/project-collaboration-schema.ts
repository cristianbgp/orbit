import { relations, sql } from "drizzle-orm";
import {
  index,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import { organization, user } from "./auth-schema";
import { project } from "./project-schema";

export const projectResponsibility = pgEnum("project_responsibility", [
  "responsible",
  "member",
]);

export const projectAssignmentEndReason = pgEnum(
  "project_assignment_end_reason",
  ["project_unassigned", "organization_removed"],
);

export const projectAssignment = pgTable(
  "project_assignment",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    projectId: text("project_id")
      .notNull()
      .references(() => project.id, { onDelete: "cascade" }),
    userId: text("user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    userNameSnapshot: text("user_name_snapshot").notNull(),
    userEmailSnapshot: text("user_email_snapshot").notNull(),
    responsibility: projectResponsibility("responsibility").notNull(),
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
    endReason: projectAssignmentEndReason("end_reason"),
  },
  (table) => [
    uniqueIndex("project_assignment_active_user_unique")
      .on(table.projectId, table.userId)
      .where(sql`${table.endedAt} is null`),
    index("project_assignment_project_responsibility_idx").on(
      table.organizationId,
      table.projectId,
      table.responsibility,
    ),
    index("project_assignment_project_ended_idx").on(
      table.organizationId,
      table.projectId,
      table.endedAt,
    ),
  ],
);

export const projectActivity = pgTable(
  "project_activity",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    projectId: text("project_id")
      .notNull()
      .references(() => project.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    actorUserId: text("actor_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    actorNameSnapshot: text("actor_name_snapshot").notNull(),
    subjectUserId: text("subject_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    subjectNameSnapshot: text("subject_name_snapshot"),
    details: jsonb("details").$type<Record<string, string | null>>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("project_activity_project_created_idx").on(
      table.organizationId,
      table.projectId,
      table.createdAt.desc(),
    ),
  ],
);

export const projectAssignmentRelations = relations(
  projectAssignment,
  ({ one }) => ({
    organization: one(organization, {
      fields: [projectAssignment.organizationId],
      references: [organization.id],
    }),
    project: one(project, {
      fields: [projectAssignment.projectId],
      references: [project.id],
    }),
    user: one(user, {
      fields: [projectAssignment.userId],
      references: [user.id],
    }),
  }),
);

export const projectActivityRelations = relations(
  projectActivity,
  ({ one }) => ({
    organization: one(organization, {
      fields: [projectActivity.organizationId],
      references: [organization.id],
    }),
    project: one(project, {
      fields: [projectActivity.projectId],
      references: [project.id],
    }),
  }),
);
