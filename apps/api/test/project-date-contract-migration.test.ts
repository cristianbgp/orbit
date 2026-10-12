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

describe("project legacy date contract migration", () => {
  let database: PGlite | undefined;

  afterEach(async () => {
    await database?.close();
  });

  test("supports old and new project writers while making end_date authoritative", async () => {
    database = createTestPGlite();
    await applyMigrationsThrough(database, 13);
    await database.exec(`
      INSERT INTO "user" (
        "id", "name", "email", "email_verified", "alias", "created_at", "updated_at"
      ) VALUES ('user-1', 'Owner One', 'owner@orbit.test', true, 'OO', now(), now());
      INSERT INTO "organization" ("id", "name", "slug", "created_at")
      VALUES ('org-1', 'Studio One', 'studio-one', now());
      INSERT INTO "client" ("id", "organization_id", "type", "name")
      VALUES ('client-1', 'org-1', 'company', 'Client One');
      INSERT INTO "project" (
        "id", "organization_id", "client_id", "name", "type", "status",
        "start_date", "internal_deadline", "legal_deadline"
      ) VALUES (
        'existing-project', 'org-1', 'client-1', 'Existing project',
        'other', 'active', '2026-08-01', '2026-08-20', '2026-08-25'
      );
    `);

    await database.exec(
      await readFile(
        `${migrationsFolder}/0014_prepare_project_date_contract.sql`,
        "utf8",
      ),
    );

    await database.exec(`
      INSERT INTO "project" (
        "id", "organization_id", "client_id", "name", "type", "status",
        "start_date", "end_date"
      ) VALUES (
        'new-writer-project', 'org-1', 'client-1', 'New writer project',
        'consultation', 'draft', '2026-08-10', '2026-08-30'
      );
      INSERT INTO "project_event" (
        "id", "organization_id", "project_id", "title", "type", "date", "created_by_user_id"
      ) VALUES (
        'new-event', 'org-1', 'new-writer-project', 'Audiencia',
        'legal', '2026-09-02', 'user-1'
      );

      INSERT INTO "project" (
        "id", "organization_id", "client_id", "name", "type", "status",
        "start_date", "internal_deadline", "legal_deadline"
      ) VALUES (
        'old-writer-project', 'org-1', 'client-1', 'Old writer project',
        'written_submission', 'active', '2026-08-12', '2026-09-05', '2026-09-08'
      );
    `);

    const projects = await database.query<{
      id: string;
      endDate: string;
      internalDeadline: string | null;
      legalDeadline: string | null;
    }>(`
      SELECT
        "id",
        "end_date"::text AS "endDate",
        "internal_deadline"::text AS "internalDeadline",
        "legal_deadline"::text AS "legalDeadline"
      FROM "project"
      ORDER BY "id"
    `);
    expect(projects.rows).toEqual([
      {
        id: "existing-project",
        endDate: "2026-08-20",
        internalDeadline: "2026-08-20",
        legalDeadline: "2026-08-25",
      },
      {
        id: "new-writer-project",
        endDate: "2026-08-30",
        internalDeadline: "2026-08-30",
        legalDeadline: "2026-08-30",
      },
      {
        id: "old-writer-project",
        endDate: "2026-09-05",
        internalDeadline: "2026-09-05",
        legalDeadline: "2026-09-08",
      },
    ]);

    const events = await database.query<{ id: string; date: string }>(`
      SELECT "id", "date"::text AS "date"
      FROM "project_event"
      ORDER BY "id"
    `);
    expect(events.rows).toEqual([
      { id: "legacy-legal:existing-project", date: "2026-08-25" },
      { id: "legacy-legal:new-writer-project", date: "2026-08-30" },
      { id: "legacy-legal:old-writer-project", date: "2026-09-08" },
      { id: "new-event", date: "2026-09-02" },
    ]);

    await database.exec(`
      UPDATE "project"
      SET
        "internal_deadline" = '2026-09-06',
        "legal_deadline" = '2026-09-09'
      WHERE "id" = 'old-writer-project';
    `);
    const oldWriterUpdate = await database.query<{
      endDate: string;
      eventDate: string;
    }>(`
      SELECT
        project."end_date"::text AS "endDate",
        project_event."date"::text AS "eventDate"
      FROM "project"
      JOIN "project_event"
        ON project_event."id" = 'legacy-legal:' || project."id"
      WHERE project."id" = 'old-writer-project'
    `);
    expect(oldWriterUpdate.rows).toEqual([
      { endDate: "2026-09-06", eventDate: "2026-09-09" },
    ]);

    const endDateConstraint = await database.query<{
      notNull: boolean;
    }>(`
      SELECT attribute.attnotnull AS "notNull"
      FROM pg_attribute AS attribute
      JOIN pg_class AS relation ON relation.oid = attribute.attrelid
      JOIN pg_namespace AS namespace ON namespace.oid = relation.relnamespace
      WHERE
        namespace.nspname = 'public'
        AND relation.relname = 'project'
        AND attribute.attname = 'end_date'
        AND attribute.attnum > 0
        AND NOT attribute.attisdropped
    `);
    expect(endDateConstraint.rows).toEqual([{ notNull: true }]);
  }, 30_000);
});
