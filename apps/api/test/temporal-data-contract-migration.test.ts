import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import type { PGlite } from "@electric-sql/pglite";
import { createTestPGlite } from "./support/create-test-pglite";
import { afterEach, describe, expect, test } from "vitest";

const migrationsFolder = fileURLToPath(new URL("../drizzle", import.meta.url));

async function applyMigrationsThrough(database: PGlite, maximum: number) {
  const migrations = (await readdir(migrationsFolder))
    .filter((name) => /^\d{4}_.+\.sql$/.test(name))
    .filter((name) => Number(name.slice(0, 4)) <= maximum)
    .sort();

  for (const migration of migrations) {
    await database.exec(
      await readFile(`${migrationsFolder}/${migration}`, "utf8"),
    );
  }
}

describe("temporal data contract migration", () => {
  let database: PGlite | undefined;

  afterEach(async () => {
    await database?.close();
  });

  test("converts every instant to timestamptz and preserves calendar dates", async () => {
    database = createTestPGlite();
    await applyMigrationsThrough(database, 15);
    await database.exec(`
      SET TIME ZONE 'America/Lima';
      INSERT INTO "user" (
        "id", "name", "email", "email_verified", "created_at", "updated_at"
      ) VALUES (
        'user-time', 'Time User', 'time@orbit.test', true,
        '2026-08-12 20:00:00', '2026-08-12 20:30:00'
      );
    `);

    await database.exec(
      await readFile(
        `${migrationsFolder}/0016_temporal_data_contract.sql`,
        "utf8",
      ),
    );

    const zoneLess = await database.query<{
      tableName: string;
      columnName: string;
    }>(`
      SELECT table_name AS "tableName", column_name AS "columnName"
      FROM information_schema.columns
      WHERE table_schema = 'public' AND data_type = 'timestamp without time zone'
      ORDER BY table_name, column_name
    `);
    expect(zoneLess.rows).toEqual([]);

    const calendarColumns = await database.query<{
      tableName: string;
      columnName: string;
      dataType: string;
    }>(`
      SELECT table_name AS "tableName", column_name AS "columnName", data_type AS "dataType"
      FROM information_schema.columns
      WHERE (table_name, column_name) IN (
        ('project', 'start_date'),
        ('project', 'end_date'),
        ('project_event', 'date'),
        ('project_task', 'planned_start_date'),
        ('project_task', 'internal_due_date')
      )
      ORDER BY table_name, column_name
    `);
    expect(calendarColumns.rows).toEqual([
      { tableName: "project", columnName: "end_date", dataType: "date" },
      { tableName: "project", columnName: "start_date", dataType: "date" },
      { tableName: "project_event", columnName: "date", dataType: "date" },
      {
        tableName: "project_task",
        columnName: "internal_due_date",
        dataType: "date",
      },
      {
        tableName: "project_task",
        columnName: "planned_start_date",
        dataType: "date",
      },
    ]);

    const instant = await database.query<{ createdAtUtc: string }>(`
      SELECT to_char(
        "created_at" AT TIME ZONE 'UTC',
        'YYYY-MM-DD HH24:MI:SS'
      ) AS "createdAtUtc"
      FROM "user"
      WHERE "id" = 'user-time'
    `);
    expect(instant.rows).toEqual([{ createdAtUtc: "2026-08-12 20:00:00" }]);
  }, 30_000);

  test("applies the complete migration history on an empty database", async () => {
    database = createTestPGlite();

    await applyMigrationsThrough(database, 16);

    const migratedColumns = await database.query<{ value: number }>(`
      SELECT count(*)::integer AS "value"
      FROM information_schema.columns
      WHERE table_schema = 'public' AND data_type = 'timestamp with time zone'
    `);
    expect(migratedColumns.rows).toEqual([{ value: 33 }]);
  }, 30_000);
});
