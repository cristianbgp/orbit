import { relations, sql } from "drizzle-orm";
import {
  boolean,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { organization } from "./auth-schema";

export const featureFlag = pgTable(
  "feature_flag",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    key: text("key").notNull(),
    organizationId: text("organization_id").references(() => organization.id, {
      onDelete: "cascade",
    }),
    enabled: boolean("enabled").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex("feature_flag_global_key_unique")
      .on(table.key)
      .where(sql`${table.organizationId} IS NULL`),
    uniqueIndex("feature_flag_organization_key_unique")
      .on(table.key, table.organizationId)
      .where(sql`${table.organizationId} IS NOT NULL`),
  ],
);

export const featureFlagRelations = relations(featureFlag, ({ one }) => ({
  organization: one(organization, {
    fields: [featureFlag.organizationId],
    references: [organization.id],
  }),
}));
