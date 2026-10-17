import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import type { PGlite } from "@electric-sql/pglite";
import { createTestPGlite } from "./support/create-test-pglite";
import { afterEach, describe, expect, test } from "vitest";

const migrationUrl = new URL(
  "../drizzle/0020_remove_cancelled_project_status.sql",
  import.meta.url,
);

describe("remove cancelled project status migration", () => {
  let database: PGlite | undefined;

  afterEach(async () => {
    await database?.close();
  });

  test("archives legacy cancelled projects before removing the enum value", async () => {
    database = createTestPGlite();
    await database.exec(`
      CREATE TYPE "project_status" AS ENUM ('draft', 'active', 'completed', 'cancelled');
      CREATE TABLE "project" (
        "id" text PRIMARY KEY,
        "status" "project_status" DEFAULT 'draft' NOT NULL,
        "archived_at" timestamptz
      );
      INSERT INTO "project" ("id", "status", "archived_at")
      VALUES
        ('cancelled-current', 'cancelled', NULL),
        ('cancelled-archived', 'cancelled', '2026-08-10T12:00:00.000Z'),
        ('completed-current', 'completed', NULL);
    `);

    const migration = await readFile(fileURLToPath(migrationUrl), "utf8").catch(
      () => "",
    );
    await database.exec(migration);

    const projects = await database.query<{
      id: string;
      status: string;
      archived: boolean;
    }>(`
      SELECT
        "id",
        "status"::text AS "status",
        "archived_at" IS NOT NULL AS "archived"
      FROM "project"
      ORDER BY "id"
    `);
    expect(projects.rows).toEqual([
      { id: "cancelled-archived", status: "active", archived: true },
      { id: "cancelled-current", status: "active", archived: true },
      { id: "completed-current", status: "completed", archived: false },
    ]);

    const enumValues = await database.query<{ value: string }>(`
      SELECT enumlabel AS "value"
      FROM pg_enum
      JOIN pg_type ON pg_type.oid = pg_enum.enumtypid
      WHERE pg_type.typname = 'project_status'
      ORDER BY enumsortorder
    `);
    expect(enumValues.rows).toEqual([
      { value: "draft" },
      { value: "active" },
      { value: "completed" },
    ]);
  });
});
