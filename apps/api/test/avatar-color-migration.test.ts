import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import type { PGlite } from "@electric-sql/pglite";
import { createTestPGlite } from "./support/create-test-pglite";
import { afterEach, describe, expect, test } from "vitest";

import {
  LEGACY_AVATAR_COLORS,
  avatarColorForUserId,
} from "../src/identity/avatar-color";

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

describe("avatar color migration", () => {
  let database: PGlite | undefined;

  afterEach(async () => {
    await database?.close();
  });

  test("backfills the former deterministic colors and enforces normalized storage", async () => {
    database = createTestPGlite();
    await applyMigrationsThrough(database, 17);
    const userIds = ["user-1", "user-2", "member-a", "member-z"];

    for (const [index, id] of userIds.entries()) {
      await database.query(
        `INSERT INTO "user" (id, name, email, email_verified, alias)
         VALUES ($1, $2, $3, true, $4)`,
        [id, `User ${index}`, `user-${index}@orbit.test`, `U${index}`],
      );
    }

    await database.exec(
      await readFile(`${migrationsFolder}/0018_user_avatar_color.sql`, "utf8"),
    );

    const rows = await database.query<{ id: string; avatarColor: string }>(`
      SELECT id, avatar_color AS "avatarColor"
      FROM "user"
      ORDER BY id
    `);
    expect(rows.rows).toEqual(
      [...userIds].sort().map((id) => ({
        id,
        avatarColor: avatarColorForUserId(id, LEGACY_AVATAR_COLORS),
      })),
    );

    await expect(
      database.exec(
        `UPDATE "user" SET avatar_color = '#FFFFFF' WHERE id = 'user-1'`,
      ),
    ).rejects.toThrow();
    const column = await database.query<{
      nullable: string;
      defaultValue: string;
    }>(`
      SELECT is_nullable AS "nullable", column_default AS "defaultValue"
      FROM information_schema.columns
      WHERE table_name = 'user' AND column_name = 'avatar_color'
    `);
    expect(column.rows).toEqual([
      { nullable: "NO", defaultValue: "'#4657d9'::text" },
    ]);
  }, 30_000);
});
