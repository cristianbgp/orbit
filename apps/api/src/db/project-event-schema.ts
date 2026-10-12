import { relations } from "drizzle-orm";
import {
  date,
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

import { organization, user } from "./auth-schema";
import { project } from "./project-schema";

export const projectEventType = pgEnum("project_event_type", [
  "legal",
  "meeting",
  "other",
]);

export const projectEvent = pgTable(
  "project_event",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    projectId: text("project_id")
      .notNull()
      .references(() => project.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    type: projectEventType("type").notNull(),
    date: date("date", { mode: "string" }).notNull(),
    description: text("description"),
    createdByUserId: text("created_by_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("project_event_organization_project_date_idx").on(
      table.organizationId,
      table.projectId,
      table.date,
      table.id,
    ),
    index("project_event_organization_date_type_idx").on(
      table.organizationId,
      table.date,
      table.type,
    ),
  ],
);

export const projectEventRelations = relations(projectEvent, ({ one }) => ({
  organization: one(organization, {
    fields: [projectEvent.organizationId],
    references: [organization.id],
  }),
  project: one(project, {
    fields: [projectEvent.projectId],
    references: [project.id],
  }),
  creator: one(user, {
    fields: [projectEvent.createdByUserId],
    references: [user.id],
  }),
}));
