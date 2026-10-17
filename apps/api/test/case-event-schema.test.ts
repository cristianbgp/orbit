import { getTableConfig } from "drizzle-orm/pg-core";
import { describe, expect, test } from "vitest";

import * as schema from "../src/db/schema";

describe("case event schema", () => {
  test("defines tenant-scoped case event dates", () => {
    const eventSchema = schema as typeof schema & {
      caseEvents?: Parameters<typeof getTableConfig>[0];
      caseEventType?: { enumValues: string[] };
    };

    expect(eventSchema.caseEvents).toBeDefined();
    expect(eventSchema.caseEventType?.enumValues).toEqual([
      "oral_argument",
      "interview",
      "other",
    ]);

    const caseEvents = eventSchema.caseEvents!;
    const config = getTableConfig(caseEvents);
    const columns = Object.fromEntries(
      config.columns.map((column) => [column.name, column]),
    );

    expect(columns.organization_id?.notNull).toBe(true);
    expect(columns.case_id?.notNull).toBe(true);
    expect(columns.title?.notNull).toBe(true);
    expect(columns.type?.notNull).toBe(true);
    expect(columns.date?.notNull).toBe(true);
    expect(columns.description?.notNull).toBe(false);
    expect(columns.created_by_user_id?.notNull).toBe(false);
    expect(columns.created_at?.notNull).toBe(true);
    expect(columns.updated_at?.notNull).toBe(true);
    expect(config.foreignKeys.map((key) => key.onDelete)).toEqual(
      expect.arrayContaining(["cascade", "cascade", "set null"]),
    );
    expect(config.indexes.map((index) => index.config.name)).toEqual(
      expect.arrayContaining([
        "case_event_organization_case_date_idx",
        "case_event_organization_date_type_idx",
      ]),
    );
  });
});
