import { getTableName } from "drizzle-orm";
import { getTableConfig } from "drizzle-orm/pg-core";
import { describe, expect, test } from "vitest";

import { caseUpdates } from "../src/db/case-update-schema";

describe("case update schema", () => {
  test("stores tenant-scoped legal updates with calendar and UTC timestamps", () => {
    const config = getTableConfig(caseUpdates);

    expect(getTableName(caseUpdates)).toBe("case_update");
    expect(caseUpdates.organizationId.notNull).toBe(true);
    expect(caseUpdates.caseId.notNull).toBe(true);
    expect(caseUpdates.date.notNull).toBe(true);
    expect(caseUpdates.date.dataType).toBe("string");
    expect(caseUpdates.description.notNull).toBe(true);
    expect(caseUpdates.createdAt.columnType).toContain("PgTimestamp");
    expect(caseUpdates.updatedAt.columnType).toContain("PgTimestamp");
    expect(caseUpdates.archivedAt.columnType).toContain("PgTimestamp");
    expect(config.foreignKeys).toHaveLength(4);
    expect(config.indexes.map((index) => index.config.name)).toEqual(
      expect.arrayContaining([
        "case_update_case_lifecycle_date_idx",
        "case_update_case_created_idx",
      ]),
    );
  });
});
