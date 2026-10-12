import { index, pgTable, text, timestamp } from "drizzle-orm/pg-core";

import { organization, user } from "./auth-schema";

export const accountRecoveryActivity = pgTable(
  "account_recovery_activity",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    actorUserId: text("actor_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    actorNameSnapshot: text("actor_name_snapshot").notNull(),
    subjectUserId: text("subject_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    subjectNameSnapshot: text("subject_name_snapshot").notNull(),
    subjectEmailSnapshot: text("subject_email_snapshot").notNull(),
    type: text("type").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("account_recovery_activity_organization_created_idx").on(
      table.organizationId,
      table.createdAt.desc(),
    ),
    index("account_recovery_activity_subject_created_idx").on(
      table.subjectUserId,
      table.createdAt.desc(),
    ),
  ],
);
