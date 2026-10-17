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

describe("project period and events expand migration", () => {
  let database: PGlite | undefined;

  afterEach(async () => {
    await database?.close();
  });

  test("backfills and preserves the already-deployed rolling-write compatibility", async () => {
    database = createTestPGlite();
    await applyMigrationsThrough(database, 12);
    await database.exec(`
      INSERT INTO "user" (
        "id", "name", "email", "email_verified", "alias", "created_at", "updated_at"
      ) VALUES
        ('user-1', 'Owner One', 'owner-1@orbit.test', true, 'OO', now(), now()),
        ('user-2', 'Owner Two', 'owner-2@orbit.test', true, 'OT', now(), now());

      INSERT INTO "organization" ("id", "name", "slug", "created_at") VALUES
        ('org-1', 'Studio One', 'studio-one', now()),
        ('org-2', 'Studio Two', 'studio-two', now());

      INSERT INTO "client" ("id", "organization_id", "type", "name") VALUES
        ('client-1', 'org-1', 'company', 'Client One'),
        ('client-2', 'org-2', 'person', 'Client Two');

      INSERT INTO "project" (
        "id", "organization_id", "client_id", "name", "type", "status",
        "start_date", "internal_deadline", "legal_deadline"
      ) VALUES
        (
          'project-1', 'org-1', 'client-1', 'Project One',
          'written_submission', 'active', '2026-08-06', '2026-08-14', '2026-08-17'
        ),
        (
          'project-2', 'org-2', 'client-2', 'Project Two',
          'consultation', 'draft', '2026-08-20', '2026-09-03', '2026-09-10'
        );
    `);

    await database.exec(
      await readFile(
        `${migrationsFolder}/0013_project_period_events_expand.sql`,
        "utf8",
      ),
    );

    const projects = await database.query<{
      id: string;
      endDate: string | null;
    }>(`
      SELECT "id", "end_date"::text AS "endDate"
      FROM "project"
      ORDER BY "id"
    `);
    expect(projects.rows).toEqual([
      { id: "project-1", endDate: "2026-08-14" },
      { id: "project-2", endDate: "2026-09-03" },
    ]);

    const events = await database.query<{
      id: string;
      organizationId: string;
      projectId: string;
      title: string;
      type: string;
      date: string;
      createdByUserId: string | null;
    }>(`
      SELECT
        "id",
        "organization_id" AS "organizationId",
        "project_id" AS "projectId",
        "title",
        "type"::text AS "type",
        "date"::text AS "date",
        "created_by_user_id" AS "createdByUserId"
      FROM "project_event"
      ORDER BY "id"
    `);
    expect(events.rows).toEqual([
      {
        id: "legacy-legal:project-1",
        organizationId: "org-1",
        projectId: "project-1",
        title: "Fecha legal",
        type: "legal",
        date: "2026-08-17",
        createdByUserId: null,
      },
      {
        id: "legacy-legal:project-2",
        organizationId: "org-2",
        projectId: "project-2",
        title: "Fecha legal",
        type: "legal",
        date: "2026-09-10",
        createdByUserId: null,
      },
    ]);

    await database.exec(`
      INSERT INTO "project_event" (
        "id", "organization_id", "project_id", "title", "type", "date"
      )
      SELECT
        'legacy-legal:' || "id",
        "organization_id",
        "id",
        'Fecha legal',
        'legal'::"project_event_type",
        "legal_deadline"
      FROM "project"
      ON CONFLICT ("id") DO NOTHING;
    `);
    const eventCount = await database.query<{ value: number }>(`
      SELECT count(*)::integer AS "value" FROM "project_event"
    `);
    expect(eventCount.rows).toEqual([{ value: 2 }]);

    await database.exec(`
      INSERT INTO "project" (
        "id", "organization_id", "client_id", "name", "type", "status",
        "start_date", "internal_deadline", "legal_deadline"
      ) VALUES (
        'old-container-project', 'org-1', 'client-1', 'Old container project',
        'other', 'draft', '2026-08-12', '2026-08-20', '2026-08-25'
      );
    `);
    const oldContainerProject = await database.query<{
      endDate: string | null;
    }>(`
      SELECT "end_date"::text AS "endDate"
      FROM "project"
      WHERE "id" = 'old-container-project'
    `);
    expect(oldContainerProject.rows).toEqual([{ endDate: "2026-08-20" }]);
    await expect(
      database.query<{
        id: string;
        date: string;
      }>(`
        SELECT "id", "date"::text AS "date"
        FROM "project_event"
        WHERE "project_id" = 'old-container-project'
      `),
    ).resolves.toMatchObject({
      rows: [
        {
          id: "legacy-legal:old-container-project",
          date: "2026-08-25",
        },
      ],
    });

    await database.exec(`
      UPDATE "project"
      SET
        "internal_deadline" = '2026-08-22',
        "legal_deadline" = '2026-08-29'
      WHERE "id" = 'old-container-project';
    `);
    const synchronized = await database.query<{
      endDate: string;
      eventDate: string;
    }>(`
      SELECT
        project."end_date"::text AS "endDate",
        project_event."date"::text AS "eventDate"
      FROM "project"
      JOIN "project_event"
        ON project_event."id" = 'legacy-legal:' || project."id"
      WHERE project."id" = 'old-container-project'
    `);
    expect(synchronized.rows).toEqual([
      { endDate: "2026-08-22", eventDate: "2026-08-29" },
    ]);
  }, 30_000);
});
