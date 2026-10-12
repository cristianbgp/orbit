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

describe("project legacy date cleanup migration", () => {
  let database: PGlite | undefined;

  afterEach(async () => {
    await database?.close();
  });

  test("drops only legacy date infrastructure and preserves project events", async () => {
    database = createTestPGlite();
    await applyMigrationsThrough(database, 14);
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
        "start_date", "end_date"
      ) VALUES (
        'project-1', 'org-1', 'client-1', 'Project One',
        'consultation', 'active', '2026-08-01', '2026-08-20'
      );
      INSERT INTO "project_event" (
        "id", "organization_id", "project_id", "title", "type", "date", "created_by_user_id"
      ) VALUES (
        'event-1', 'org-1', 'project-1', 'Audiencia',
        'legal', '2026-08-25', 'user-1'
      );
    `);

    await database.exec(
      await readFile(
        `${migrationsFolder}/0015_drop_legacy_project_dates.sql`,
        "utf8",
      ),
    );

    const columns = await database.query<{ name: string }>(`
      SELECT attribute.attname AS "name"
      FROM pg_attribute AS attribute
      JOIN pg_class AS relation ON relation.oid = attribute.attrelid
      JOIN pg_namespace AS namespace ON namespace.oid = relation.relnamespace
      WHERE
        namespace.nspname = 'public'
        AND relation.relname = 'project'
        AND attribute.attnum > 0
        AND NOT attribute.attisdropped
      ORDER BY attribute.attnum
    `);
    expect(columns.rows.map(({ name }) => name)).toEqual(
      expect.arrayContaining(["start_date", "end_date"]),
    );
    expect(columns.rows.map(({ name }) => name)).not.toEqual(
      expect.arrayContaining(["internal_deadline", "legal_deadline"]),
    );

    const indexes = await database.query<{ name: string }>(`
      SELECT indexname AS "name"
      FROM pg_indexes
      WHERE schemaname = 'public' AND tablename = 'project'
      ORDER BY indexname
    `);
    expect(indexes.rows.map(({ name }) => name)).not.toEqual(
      expect.arrayContaining([
        "project_organization_legal_deadline_idx",
        "project_organization_archived_legal_deadline_idx",
      ]),
    );

    const triggers = await database.query<{ value: number }>(`
      SELECT count(*)::integer AS "value"
      FROM pg_trigger
      WHERE
        tgrelid = 'public.project'::regclass
        AND NOT tgisinternal
        AND tgname IN (
          'project_period_compat_before_write',
          'project_legal_event_compat_after_write'
        )
    `);
    expect(triggers.rows).toEqual([{ value: 0 }]);

    const functions = await database.query<{ value: number }>(`
      SELECT count(*)::integer AS "value"
      FROM pg_proc
      JOIN pg_namespace ON pg_namespace.oid = pg_proc.pronamespace
      WHERE
        pg_namespace.nspname = 'public'
        AND pg_proc.proname IN (
          'orbit_sync_project_period_compat',
          'orbit_sync_project_legal_event_compat'
        )
    `);
    expect(functions.rows).toEqual([{ value: 0 }]);

    const preservedEvents = await database.query<{
      id: string;
      title: string;
      date: string;
    }>(`
        SELECT "id", "title", "date"::text AS "date"
        FROM "project_event"
        ORDER BY "id"
      `);
    expect(preservedEvents.rows).toEqual([
      {
        id: "event-1",
        title: "Audiencia",
        date: "2026-08-25",
      },
      {
        id: "legacy-legal:project-1",
        title: "Fecha legal",
        date: "2026-08-20",
      },
    ]);

    await database.exec(`
      INSERT INTO "project" (
        "id", "organization_id", "client_id", "name", "type", "status",
        "start_date", "end_date"
      ) VALUES (
        'project-2', 'org-1', 'client-1', 'Project Two',
        'other', 'draft', '2026-08-10', '2026-08-30'
      );
    `);
    const currentWriterProject = await database.query<{
      id: string;
      endDate: string;
    }>(`
      SELECT "id", "end_date"::text AS "endDate"
      FROM "project"
      WHERE "id" = 'project-2'
    `);
    expect(currentWriterProject.rows).toEqual([
      { id: "project-2", endDate: "2026-08-30" },
    ]);
  }, 30_000);
});
