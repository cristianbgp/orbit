import { relations, sql } from "drizzle-orm";
import {
  check,
  date,
  index,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import { organization, user } from "./auth-schema";
import { client } from "./client-schema";

export const caseType = pgEnum("case_type", [
  "administrative",
  "judicial",
  "constitutional",
  "other",
]);

export const caseStatus = pgEnum("case_status", ["in_progress", "concluded"]);
export const caseResult = pgEnum("case_result", [
  "founded",
  "unfounded",
  "inadmissible",
]);
export const casePeriodKind = pgEnum("case_period_kind", [
  "year",
  "month",
  "month_range",
]);
export const caseCurrency = pgEnum("case_currency", ["PEN", "USD"]);
export const caseClaimantType = pgEnum("case_claimant_type", [
  "client",
  "sunat",
]);
export const caseResponsibility = pgEnum("case_responsibility", [
  "member",
  "follower",
]);
export const caseAssignmentEndReason = pgEnum("case_assignment_end_reason", [
  "case_unassigned",
  "organization_removed",
]);

export const legalCases = pgTable(
  "legal_case",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    clientId: text("client_id")
      .notNull()
      .references(() => client.id, { onDelete: "restrict" }),
    identification: text("identification").notNull(),
    type: caseType("type"),
    subtype: text("subtype"),
    stage: text("stage"),
    entity: text("entity"),
    docketNumber: text("docket_number"),
    tax: text("tax"),
    periodKind: casePeriodKind("period_kind"),
    periodStart: date("period_start", { mode: "string" }),
    periodEnd: date("period_end", { mode: "string" }),
    amount: numeric("amount", { precision: 18, scale: 2 }),
    currency: caseCurrency("currency"),
    claimantType: caseClaimantType("claimant_type"),
    disputedMatter: text("disputed_matter"),
    challengedResolution: text("challenged_resolution"),
    status: caseStatus("status").default("in_progress").notNull(),
    result: caseResult("result"),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
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
    index("legal_case_organization_idx").on(table.organizationId),
    index("legal_case_organization_client_idx").on(
      table.organizationId,
      table.clientId,
    ),
    index("legal_case_organization_status_idx").on(
      table.organizationId,
      table.status,
      table.archivedAt,
    ),
    index("legal_case_organization_type_idx").on(
      table.organizationId,
      table.type,
    ),
    index("legal_case_organization_identification_idx").on(
      table.organizationId,
      table.identification,
    ),
    check(
      "legal_case_status_result_check",
      sql`(${table.status} = 'in_progress' and ${table.result} is null) or (${table.status} = 'concluded' and ${table.result} is not null)`,
    ),
    check(
      "legal_case_amount_currency_check",
      sql`(${table.amount} is null and ${table.currency} is null) or (${table.amount} is not null and ${table.currency} is not null)`,
    ),
    check(
      "legal_case_period_check",
      sql`(${table.periodKind} is null and ${table.periodStart} is null and ${table.periodEnd} is null) or (${table.periodKind} is not null and ${table.periodStart} is not null and ${table.periodEnd} is not null and ${table.periodStart} <= ${table.periodEnd})`,
    ),
    check(
      "legal_case_claimant_type_check",
      sql`(${table.type} = 'judicial' and ${table.claimantType} is not null) or (${table.type} is distinct from 'judicial' and ${table.claimantType} is null)`,
    ),
    check(
      "legal_case_docket_stage_check",
      sql`${table.stage} is not null or ${table.docketNumber} is null`,
    ),
  ],
);

export const caseAssignments = pgTable(
  "case_assignment",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    caseId: text("case_id")
      .notNull()
      .references(() => legalCases.id, { onDelete: "cascade" }),
    userId: text("user_id").references(() => user.id, { onDelete: "set null" }),
    userNameSnapshot: text("user_name_snapshot").notNull(),
    userEmailSnapshot: text("user_email_snapshot").notNull(),
    responsibility: caseResponsibility("responsibility")
      .default("member")
      .notNull(),
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
    endReason: caseAssignmentEndReason("end_reason"),
  },
  (table) => [
    uniqueIndex("case_assignment_active_user_responsibility_unique")
      .on(table.caseId, table.userId, table.responsibility)
      .where(sql`${table.endedAt} is null`),
    index("case_assignment_case_ended_idx").on(
      table.organizationId,
      table.caseId,
      table.endedAt,
    ),
  ],
);

export const caseActivities = pgTable(
  "case_activity",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    caseId: text("case_id")
      .notNull()
      .references(() => legalCases.id, { onDelete: "cascade" }),
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
    index("case_activity_case_created_idx").on(
      table.organizationId,
      table.caseId,
      table.createdAt.desc(),
    ),
    index("case_activity_organization_created_idx").on(
      table.organizationId,
      table.createdAt.desc(),
    ),
  ],
);

export const legalCaseRelations = relations(legalCases, ({ one, many }) => ({
  organization: one(organization, {
    fields: [legalCases.organizationId],
    references: [organization.id],
  }),
  client: one(client, {
    fields: [legalCases.clientId],
    references: [client.id],
  }),
  assignments: many(caseAssignments),
  activities: many(caseActivities),
}));

export const caseAssignmentRelations = relations(
  caseAssignments,
  ({ one }) => ({
    case: one(legalCases, {
      fields: [caseAssignments.caseId],
      references: [legalCases.id],
    }),
  }),
);

export const caseActivityRelations = relations(caseActivities, ({ one }) => ({
  case: one(legalCases, {
    fields: [caseActivities.caseId],
    references: [legalCases.id],
  }),
}));
