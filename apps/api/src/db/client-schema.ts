import { relations } from "drizzle-orm";
import { index, pgEnum, pgTable, text, timestamp } from "drizzle-orm/pg-core";

import { organization } from "./auth-schema";

export const clientType = pgEnum("client_type", ["person", "company"]);

export const client = pgTable(
  "client",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    type: clientType("type").notNull(),
    name: text("name").notNull(),
    documentType: text("document_type"),
    documentNumber: text("document_number"),
    email: text("email"),
    phone: text("phone"),
    address: text("address"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("client_organization_id_idx").on(table.organizationId),
    index("client_organization_name_idx").on(table.organizationId, table.name),
    index("client_organization_document_idx").on(
      table.organizationId,
      table.documentNumber,
    ),
  ],
);

export const clientRelations = relations(client, ({ one }) => ({
  organization: one(organization, {
    fields: [client.organizationId],
    references: [organization.id],
  }),
}));
