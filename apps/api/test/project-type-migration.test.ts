import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import type { PGlite } from "@electric-sql/pglite";
import { createTestPGlite } from "./support/create-test-pglite";
import { afterEach, describe, expect, test } from "vitest";

const migrationUrl = new URL(
  "../drizzle/0010_fancy_killer_shrike.sql",
  import.meta.url,
);
const oralArgumentMigrationUrl = new URL(
  "../drizzle/0011_add_oral_argument_project_type.sql",
  import.meta.url,
);

describe("project type catalog migration", () => {
  let database: PGlite | undefined;

  afterEach(async () => {
    await database?.close();
  });

  test("converts legacy project types to other without changing stages", async () => {
    database = createTestPGlite();
    await database.exec(`
      CREATE TYPE "project_type" AS ENUM (
        'appeal',
        'labor_lawsuit',
        'due_diligence',
        'other'
      );
      CREATE TABLE "project" (
        "id" text PRIMARY KEY,
        "type" "project_type" NOT NULL
      );
      CREATE TABLE "project_stage" (
        "id" text PRIMARY KEY,
        "project_id" text NOT NULL REFERENCES "project"("id"),
        "name" text NOT NULL
      );
      INSERT INTO "project" ("id", "type") VALUES
        ('appeal', 'appeal'),
        ('labor', 'labor_lawsuit'),
        ('due-diligence', 'due_diligence'),
        ('other', 'other');
      INSERT INTO "project_stage" ("id", "project_id", "name")
      VALUES ('stage-1', 'appeal', 'Etapa existente');
    `);

    const migration = await readFile(fileURLToPath(migrationUrl), "utf8");
    await database.exec(migration);
    const oralArgumentMigration = await readFile(
      fileURLToPath(oralArgumentMigrationUrl),
      "utf8",
    );
    await database.exec(oralArgumentMigration);

    const projects = await database.query<{ id: string; type: string }>(`
      SELECT "id", "type"::text AS "type"
      FROM "project"
      ORDER BY "id"
    `);
    expect(projects.rows).toEqual([
      { id: "appeal", type: "other" },
      { id: "due-diligence", type: "other" },
      { id: "labor", type: "other" },
      { id: "other", type: "other" },
    ]);

    const enumValues = await database.query<{ value: string }>(`
      SELECT enumlabel AS "value"
      FROM pg_enum
      JOIN pg_type ON pg_type.oid = pg_enum.enumtypid
      WHERE pg_type.typname = 'project_type'
      ORDER BY enumsortorder
    `);
    expect(enumValues.rows).toEqual([
      { value: "written_submission" },
      { value: "consultation" },
      { value: "oral_argument" },
      { value: "other" },
    ]);

    const stages = await database.query<{
      id: string;
      projectId: string;
      name: string;
    }>(`
      SELECT "id", "project_id" AS "projectId", "name"
      FROM "project_stage"
    `);
    expect(stages.rows).toEqual([
      {
        id: "stage-1",
        projectId: "appeal",
        name: "Etapa existente",
      },
    ]);
  });
});
