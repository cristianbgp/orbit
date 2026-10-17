import type { PGlite } from "@electric-sql/pglite";
import { createTestPGlite } from "./support/create-test-pglite";
import { afterEach, describe, expect, test } from "vitest";
import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { invitation, member } from "../src/db/auth-schema";

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

describe("studio member position migration", () => {
  let database: PGlite | undefined;

  afterEach(async () => {
    await database?.close();
  });

  test("keeps position nullable on invitations and memberships", () => {
    expect(invitation.position.notNull).toBe(false);
    expect(member.position.notNull).toBe(false);
  });

  test("adds both columns through a new 0019 migration", async () => {
    const migrationUrl = new URL(
      "../drizzle/0019_studio_member_position.sql",
      import.meta.url,
    );

    const sql = await readFile(migrationUrl, "utf8").catch(() => "");
    expect(sql).not.toBe("");
    expect(sql).toContain(
      'ALTER TABLE "invitation" ADD COLUMN "position" text;',
    );
    expect(sql).toContain('ALTER TABLE "member" ADD COLUMN "position" text;');
  });

  test("applies after every previously shipped migration", async () => {
    database = createTestPGlite();
    await applyMigrationsThrough(database, 18);
    await database.exec(
      await readFile(
        `${migrationsFolder}/0019_studio_member_position.sql`,
        "utf8",
      ),
    );

    const columns = await database.query<{
      tableName: string;
      nullable: string;
    }>(`
      SELECT table_name AS "tableName", is_nullable AS "nullable"
      FROM information_schema.columns
      WHERE column_name = 'position'
        AND table_name IN ('invitation', 'member')
      ORDER BY table_name
    `);

    expect(columns.rows).toEqual([
      { tableName: "invitation", nullable: "YES" },
      { tableName: "member", nullable: "YES" },
    ]);
  }, 30_000);
});
