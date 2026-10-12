import { getTableName } from "drizzle-orm";
import { getTableConfig } from "drizzle-orm/pg-core";
import { describe, expect, test } from "vitest";

import {
  caseActivities,
  caseAssignments,
  caseCurrency,
  casePeriodKind,
  caseResponsibility,
  caseResult,
  caseStatus,
  legalCases,
} from "../src/db/case-schema";

describe("case schema", () => {
  test("defines the independent tenant-scoped case aggregate", () => {
    const config = getTableConfig(legalCases);

    expect(getTableName(legalCases)).toBe("legal_case");
    expect(legalCases.organizationId.notNull).toBe(true);
    expect(legalCases.clientId.notNull).toBe(true);
    expect(legalCases.identification.notNull).toBe(true);
    expect(legalCases.type.notNull).toBe(false);
    expect(legalCases.periodStart.notNull).toBe(false);
    expect(legalCases.amount.notNull).toBe(false);
    expect(legalCases.createdAt.columnType).toContain("PgTimestamp");
    expect(config.foreignKeys).toHaveLength(3);
    expect(config.indexes.map((index) => index.config.name)).toEqual(
      expect.arrayContaining([
        "legal_case_organization_idx",
        "legal_case_organization_client_idx",
        "legal_case_organization_status_idx",
        "legal_case_organization_type_idx",
      ]),
    );
    expect(config.checks.map((constraint) => constraint.name)).toEqual(
      expect.arrayContaining([
        "legal_case_status_result_check",
        "legal_case_amount_currency_check",
        "legal_case_period_check",
      ]),
    );
  });

  test("uses the approved lifecycle, result, period, and currency values", () => {
    expect(caseStatus.enumValues).toEqual(["in_progress", "concluded"]);
    expect(caseResult.enumValues).toEqual([
      "founded",
      "unfounded",
      "inadmissible",
    ]);
    expect(casePeriodKind.enumValues).toEqual(["year", "month", "month_range"]);
    expect(caseCurrency.enumValues).toEqual(["PEN", "USD"]);
  });

  test("preserves assignment history and immutable activity", () => {
    const assignmentConfig = getTableConfig(caseAssignments);
    const activityConfig = getTableConfig(caseActivities);

    expect(caseAssignments.responsibility.notNull).toBe(true);
    expect(caseAssignments.userNameSnapshot.notNull).toBe(true);
    expect(caseAssignments.endedAt.notNull).toBe(false);
    expect(
      assignmentConfig.indexes.map((index) => index.config.name),
    ).toContain("case_assignment_active_user_responsibility_unique");
    expect(caseResponsibility.enumValues).toEqual(["member", "follower"]);
    expect(caseActivities.actorNameSnapshot.notNull).toBe(true);
    expect(caseActivities.details.notNull).toBe(true);
    expect(activityConfig.indexes.map((index) => index.config.name)).toContain(
      "case_activity_case_created_idx",
    );
  });
});
