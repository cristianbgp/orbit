import { relations } from "drizzle-orm";
import { index, pgEnum, pgTable, text, timestamp } from "drizzle-orm/pg-core";

import { organization, user } from "./auth-schema";
import { legalCases } from "./case-schema";

export const caseActionStatus = pgEnum("case_action_status", [
  "pending",
  "completed",
]);

export const caseActions = pgTable(
  "case_action",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    caseId: text("case_id")
      .notNull()
      .references(() => legalCases.id, { onDelete: "cascade" }),
    description: text("description").notNull(),
    assigneeUserId: text("assignee_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    assigneeNameSnapshot: text("assignee_name_snapshot"),
    status: caseActionStatus("status").default("pending").notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    completedByUserId: text("completed_by_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    createdByUserId: text("created_by_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    archivedByUserId: text("archived_by_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
  },
  (table) => [
    index("case_action_case_lifecycle_created_idx").on(
      table.organizationId,
      table.caseId,
      table.archivedAt,
      table.status,
      table.createdAt.desc(),
    ),
    index("case_action_assignee_lifecycle_created_idx").on(
      table.organizationId,
      table.assigneeUserId,
      table.archivedAt,
      table.status,
      table.createdAt.desc(),
    ),
  ],
);

export const caseActionRelations = relations(caseActions, ({ one }) => ({
  case: one(legalCases, {
    fields: [caseActions.caseId],
    references: [legalCases.id],
  }),
  assignee: one(user, {
    fields: [caseActions.assigneeUserId],
    references: [user.id],
  }),
}));
