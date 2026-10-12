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

export const caseEventType = pgEnum("case_event_type", [
  "oral_argument",
  "interview",
  "other",
]);

export const caseEvents = pgTable(
  "case_event",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    caseId: text("case_id")
      .notNull()
      .references(() => legalCases.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    type: caseEventType("type").notNull(),
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
    index("case_event_organization_case_date_idx").on(
      table.organizationId,
      table.caseId,
      table.date,
      table.id,
    ),
    index("case_event_organization_date_type_idx").on(
      table.organizationId,
      table.date,
      table.type,
    ),
  ],
);

export const caseEventRelations = relations(caseEvents, ({ one }) => ({
  organization: one(organization, {
    fields: [caseEvents.organizationId],
    references: [organization.id],
  }),
  case: one(legalCases, {
    fields: [caseEvents.caseId],
    references: [legalCases.id],
  }),
  creator: one(user, {
    fields: [caseEvents.createdByUserId],
    references: [user.id],
  }),
}));
