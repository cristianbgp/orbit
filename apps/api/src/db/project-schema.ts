import { relations } from "drizzle-orm";
import {
  date,
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

import { organization } from "./auth-schema";
import { client } from "./client-schema";

export const projectType = pgEnum("project_type", [
  "written_submission",
  "consultation",
  "oral_argument",
  "other",
]);

export const projectStatus = pgEnum("project_status", [
  "draft",
  "active",
  "completed",
]);

export const project = pgTable(
  "project",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    clientId: text("client_id")
      .notNull()
      .references(() => client.id, { onDelete: "restrict" }),
    name: text("name").notNull(),
    type: projectType("type").notNull(),
    status: projectStatus("status").default("draft").notNull(),
    startDate: date("start_date", { mode: "string" }).notNull(),
    endDate: date("end_date", { mode: "string" }).notNull(),
    internalReference: text("internal_reference"),
    description: text("description"),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("project_organization_id_idx").on(table.organizationId),
    index("project_organization_client_idx").on(
      table.organizationId,
      table.clientId,
    ),
    index("project_organization_name_idx").on(table.organizationId, table.name),
  ],
);

export const projectRelations = relations(project, ({ one }) => ({
  organization: one(organization, {
    fields: [project.organizationId],
    references: [organization.id],
  }),
  client: one(client, {
    fields: [project.clientId],
    references: [client.id],
  }),
}));
