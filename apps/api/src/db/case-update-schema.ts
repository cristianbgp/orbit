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
import { legalCases } from "./case-schema";

export const caseUpdateKind = pgEnum("case_update_kind", [
  "update",
  "background",
]);

export const caseUpdates = pgTable(
  "case_update",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    caseId: text("case_id")
      .notNull()
      .references(() => legalCases.id, { onDelete: "cascade" }),
    date: date("date", { mode: "string" }).notNull(),
    description: text("description").notNull(),
    kind: caseUpdateKind("kind").default("update").notNull(),
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
    index("case_update_case_lifecycle_date_idx").on(
      table.organizationId,
      table.caseId,
      table.archivedAt,
      table.date.desc(),
    ),
    index("case_update_case_created_idx").on(
      table.organizationId,
      table.caseId,
      table.createdAt.desc(),
    ),
    index("case_update_case_kind_date_idx").on(
      table.organizationId,
      table.caseId,
      table.archivedAt,
      table.kind,
      table.date.desc(),
    ),
  ],
);

export const caseUpdateRelations = relations(caseUpdates, ({ one }) => ({
  case: one(legalCases, {
    fields: [caseUpdates.caseId],
    references: [legalCases.id],
  }),
}));
