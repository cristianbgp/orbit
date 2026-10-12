import { relations } from "drizzle-orm";
import { index, integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";

import { organization } from "./auth-schema";
import { project } from "./project-schema";

export const projectStage = pgTable(
  "project_stage",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    projectId: text("project_id")
      .notNull()
      .references(() => project.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    position: integer("position").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("project_stage_organization_project_position_idx").on(
      table.organizationId,
      table.projectId,
      table.position,
    ),
  ],
);

export const projectStageRelations = relations(projectStage, ({ one }) => ({
  organization: one(organization, {
    fields: [projectStage.organizationId],
    references: [organization.id],
  }),
  project: one(project, {
    fields: [projectStage.projectId],
    references: [project.id],
  }),
}));
