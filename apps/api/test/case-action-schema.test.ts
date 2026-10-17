import { getTableName } from "drizzle-orm";
import { getTableConfig } from "drizzle-orm/pg-core";
import { describe, expect, test } from "vitest";

import { caseActions } from "../src/db/case-action-schema";

describe("case action schema", () => {
  test("stores tenant-scoped work with optional assignee and UTC lifecycle timestamps", () => {
    const config = getTableConfig(caseActions);

    expect(getTableName(caseActions)).toBe("case_action");
    expect(caseActions.organizationId.notNull).toBe(true);
    expect(caseActions.caseId.notNull).toBe(true);
    expect(caseActions.description.notNull).toBe(true);
    expect(caseActions.assigneeUserId.notNull).toBe(false);
    expect(caseActions.assigneeNameSnapshot.notNull).toBe(false);
    expect(caseActions.status.notNull).toBe(true);
    expect(caseActions.createdAt.columnType).toContain("PgTimestamp");
    expect(caseActions.updatedAt.columnType).toContain("PgTimestamp");
    expect(caseActions.completedAt.columnType).toContain("PgTimestamp");
    expect(caseActions.archivedAt.columnType).toContain("PgTimestamp");
    expect(config.foreignKeys).toHaveLength(6);
    expect(config.indexes.map((index) => index.config.name)).toEqual(
      expect.arrayContaining([
        "case_action_case_lifecycle_created_idx",
        "case_action_assignee_lifecycle_created_idx",
      ]),
    );
  });
});
