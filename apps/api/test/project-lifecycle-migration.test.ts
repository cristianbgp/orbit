import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import type { PGlite } from "@electric-sql/pglite";
import { createTestPGlite } from "./support/create-test-pglite";
import { afterEach, describe, expect, test } from "vitest";

const migrationUrl = new URL(
  "../drizzle/0012_add_project_lifecycle.sql",
  import.meta.url,
);

describe("project lifecycle migration", () => {
  let database: PGlite | undefined;

  afterEach(async () => {
    await database?.close();
  });

  test("adds lifecycle statuses and nullable archive state without changing existing rows", async () => {
    database = createTestPGlite();
    await database.exec(`
      CREATE TYPE "project_status" AS ENUM ('draft', 'active');
      CREATE TABLE "project" (
        "id" text PRIMARY KEY,
        "organization_id" text NOT NULL,
        "status" "project_status" NOT NULL,
        "legal_deadline" date NOT NULL
      );
      INSERT INTO "project" ("id", "organization_id", "status", "legal_deadline")
      VALUES
        ('draft-project', 'org-1', 'draft', '2026-08-12'),
        ('active-project', 'org-1', 'active', '2026-08-13');
    `);

    const migration = await readFile(fileURLToPath(migrationUrl), "utf8");
    await database.exec(migration);

    await database.exec(`
      INSERT INTO "project" ("id", "organization_id", "status", "legal_deadline")
      VALUES
        ('completed-project', 'org-1', 'completed', '2026-08-14'),
        ('cancelled-project', 'org-1', 'cancelled', '2026-08-15');
    `);

    const projects = await database.query<{
      id: string;
      status: string;
      archivedAt: Date | null;
    }>(`
      SELECT
        "id",
        "status"::text AS "status",
        "archived_at" AS "archivedAt"
      FROM "project"
      ORDER BY "id"
    `);
    expect(projects.rows).toEqual([
      { id: "active-project", status: "active", archivedAt: null },
      { id: "cancelled-project", status: "cancelled", archivedAt: null },
      { id: "completed-project", status: "completed", archivedAt: null },
      { id: "draft-project", status: "draft", archivedAt: null },
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
      { value: "cancelled" },
    ]);

    const indexes = await database.query<{ name: string }>(`
      SELECT indexname AS "name"
      FROM pg_indexes
      WHERE tablename = 'project'
    `);
    expect(indexes.rows.map(({ name }) => name)).toContain(
      "project_organization_archived_legal_deadline_idx",
    );
  });
});
