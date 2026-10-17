import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import type { PGlite } from "@electric-sql/pglite";
import { createTestPGlite } from "./support/create-test-pglite";
import { afterEach, describe, expect, test } from "vitest";

import { generateUserAlias } from "../src/identity/user-alias";
import { USER_ALIAS_GENERATOR_CODE_POINT_COUNT } from "../src/identity/user-alias-repertoire";

const migrationUrl = new URL(
  "../drizzle/0009_bizarre_dragon_lord.sql",
  import.meta.url,
);

describe("user alias expand migration", () => {
  let database: PGlite | undefined;

  afterEach(async () => {
    await database?.close();
  });

  test("backfills valid aliases while keeping storage nullable for old instances", async () => {
    database = createTestPGlite();
    await database.exec(`
      CREATE TABLE "user" (
        "id" text PRIMARY KEY,
        "name" text NOT NULL
      );
      INSERT INTO "user" ("id", "name") VALUES
        ('normal', 'Cristian Granda Pastora'),
        ('punctuation', 'Ana-María Pérez'),
        ('leading', '---9 vidas'),
        ('accented', 'Élodie Dupont'),
        ('special-case', 'ß X'),
        ('fraction', '½'),
        ('superscript', '²'),
        ('non-portable-number', '௰'),
        ('single', 'Q'),
        ('empty', ''),
        ('whitespace', '   '),
        ('symbols', '!!!'),
        ('cap', 'A B C D E F G H I J K L M N');
    `);

    const migration = await readFile(fileURLToPath(migrationUrl), "utf8");
    await database.exec(migration);

    const aliases = await database.query<{
      id: string;
      name: string;
      alias: string | null;
    }>('SELECT "id", "name", "alias" FROM "user" ORDER BY "id"');
    expect(
      aliases.rows.map(({ id, name, alias }) => ({
        id,
        alias,
        runtimeAlias: generateUserAlias(name),
      })),
    ).toEqual(
      aliases.rows.map(({ id, name }) => ({
        id,
        alias: generateUserAlias(name),
        runtimeAlias: generateUserAlias(name),
      })),
    );

    const exhaustiveParity = await database.query<{
      codePoint: number;
      alias: string;
    }>(`
      SELECT
        code_point AS "codePoint",
        public.orbit_generate_user_alias(chr(code_point)) AS "alias"
      FROM generate_series(0, 1114111) AS code_points(code_point)
      WHERE public.orbit_alias_code_point_allowed(code_point)
      ORDER BY code_point
    `);
    expect(exhaustiveParity.rows).toHaveLength(
      USER_ALIAS_GENERATOR_CODE_POINT_COUNT,
    );
    let mismatch:
      | {
          codePoint: number;
          databaseAlias: string;
          runtimeAlias: string;
          databaseCodePoints: number[];
          runtimeCodePoints: number[];
        }
      | undefined;
    for (const { codePoint, alias } of exhaustiveParity.rows) {
      const numericCodePoint = Number(codePoint);
      const runtimeAlias = generateUserAlias(
        String.fromCodePoint(numericCodePoint),
      );
      if (alias !== runtimeAlias) {
        mismatch = {
          codePoint: numericCodePoint,
          databaseAlias: alias,
          runtimeAlias,
          databaseCodePoints: Array.from(alias, (character) =>
            character.codePointAt(0)!,
          ),
          runtimeCodePoints: Array.from(runtimeAlias, (character) =>
            character.codePointAt(0)!,
          ),
        };
        break;
      }
    }
    expect(mismatch).toBeUndefined();

    await expect(
      database.exec(
        `INSERT INTO "user" ("id", "name") VALUES ('old-app', 'Old App')`,
      ),
    ).resolves.toBeDefined();
    const oldApp = await database.query<{ alias: string | null }>(
      `SELECT "alias" FROM "user" WHERE "id" = 'old-app'`,
    );
    expect(oldApp.rows).toEqual([{ alias: null }]);

    const searchableFallback = await database.query<{ id: string }>(`
      SELECT "id"
      FROM "user"
      WHERE coalesce("alias", public.orbit_generate_user_alias("name")) ILIKE '%OA%'
    `);
    expect(searchableFallback.rows).toEqual([{ id: "old-app" }]);
  }, 60_000);
});
