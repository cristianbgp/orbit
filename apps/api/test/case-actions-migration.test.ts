import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import type { PGlite } from "@electric-sql/pglite";
import { afterEach, describe, expect, test } from "vitest";

import { createTestPGlite } from "./support/create-test-pglite";

const migrationsFolder = fileURLToPath(new URL("../drizzle", import.meta.url));

describe("case actions migration", () => {
  let database: PGlite | undefined;

  afterEach(async () => database?.close());

  test("creates optional assignment and timezone-aware lifecycle columns", async () => {
    database = createTestPGlite();
    const migrations = (await readdir(migrationsFolder))
      .filter((name) => /^\d{4}_.+\.sql$/.test(name))
      .sort();

    for (const migration of migrations) {
      await database.exec(
        await readFile(`${migrationsFolder}/${migration}`, "utf8"),
      );
    }

    const columns = await database.query<{
      column_name: string;
      data_type: string;
      is_nullable: "YES" | "NO";
    }>(`
      select column_name, data_type, is_nullable
      from information_schema.columns
      where table_name = 'case_action'
        and column_name in ('description', 'assignee_user_id', 'status', 'created_at', 'updated_at', 'completed_at', 'archived_at')
      order by column_name
    `);

    expect(columns.rows).toEqual([
      {
        column_name: "archived_at",
        data_type: "timestamp with time zone",
        is_nullable: "YES",
      },
      {
        column_name: "assignee_user_id",
        data_type: "text",
        is_nullable: "YES",
      },
      {
        column_name: "completed_at",
        data_type: "timestamp with time zone",
        is_nullable: "YES",
      },
      {
        column_name: "created_at",
        data_type: "timestamp with time zone",
        is_nullable: "NO",
      },
      { column_name: "description", data_type: "text", is_nullable: "NO" },
      { column_name: "status", data_type: "USER-DEFINED", is_nullable: "NO" },
      {
        column_name: "updated_at",
        data_type: "timestamp with time zone",
        is_nullable: "NO",
      },
    ]);
  }, 30_000);
});
