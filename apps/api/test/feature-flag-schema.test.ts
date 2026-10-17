import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import type { PGlite } from "@electric-sql/pglite";
import { createTestPGlite } from "./support/create-test-pglite";
import { afterEach, beforeEach, describe, expect, test } from "vitest";

describe("feature flag schema", () => {
  let pg: PGlite;

  beforeEach(async () => {
    pg = createTestPGlite();
    const folder = fileURLToPath(new URL("../drizzle", import.meta.url));
    for (const migration of (await readdir(folder))
      .filter((name) => /^\d{4}_.+\.sql$/.test(name))
      .sort()) {
      await pg.exec(await readFile(`${folder}/${migration}`, "utf8"));
    }

    await pg.exec(`
      INSERT INTO organization (id, name, slug, created_at)
      VALUES
        ('org-1', 'Orbit Uno', 'orbit-uno', '2026-08-13T10:00:00.000Z'),
        ('org-2', 'Orbit Dos', 'orbit-dos', '2026-08-13T10:00:00.000Z');
    `);
  });

  afterEach(async () => {
    await pg.close();
  });

  test("stores one global value and one override per organization", async () => {
    await pg.exec(`
      INSERT INTO feature_flag (key, organization_id, enabled)
      VALUES
        ('orbit_help_assistant', NULL, false),
        ('orbit_help_assistant', 'org-1', true),
        ('orbit_help_assistant', 'org-2', false);
    `);

    await expect(
      pg.exec(`
        INSERT INTO feature_flag (key, organization_id, enabled)
        VALUES ('orbit_help_assistant', NULL, true);
      `),
    ).rejects.toThrow();
    await expect(
      pg.exec(`
        INSERT INTO feature_flag (key, organization_id, enabled)
        VALUES ('orbit_help_assistant', 'org-1', false);
      `),
    ).rejects.toThrow();

    const rows = await pg.query<{
      id: string;
      organization_id: string | null;
      created_at: Date;
      updated_at: Date;
    }>(`
      SELECT id, organization_id, created_at, updated_at
      FROM feature_flag
      ORDER BY organization_id NULLS FIRST;
    `);
    expect(rows.rows).toHaveLength(3);
    for (const row of rows.rows) {
      expect(row.id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
      );
      expect(row.created_at).toBeInstanceOf(Date);
      expect(row.updated_at).toBeInstanceOf(Date);
    }

    const timestampColumns = await pg.query<{ column_name: string }>(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'feature_flag'
        AND data_type = 'timestamp with time zone'
      ORDER BY column_name;
    `);
    expect(timestampColumns.rows.map((row) => row.column_name)).toEqual([
      "created_at",
      "updated_at",
    ]);

    await pg.exec(`DELETE FROM organization WHERE id = 'org-1';`);
    const remaining = await pg.query<{ organization_id: string | null }>(`
      SELECT organization_id
      FROM feature_flag
      ORDER BY organization_id NULLS FIRST;
    `);
    expect(remaining.rows).toEqual([
      { organization_id: null },
      { organization_id: "org-2" },
    ]);
  });
});
