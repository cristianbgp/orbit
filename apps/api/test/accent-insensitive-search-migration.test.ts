import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import type { PGlite } from "@electric-sql/pglite";
import { afterEach, beforeEach, describe, expect, test } from "vitest";

import { createTestPGlite } from "./support/create-test-pglite";

describe("accent-insensitive search migration", () => {
  let database: PGlite;

  beforeEach(async () => {
    database = createTestPGlite();
    const migrationsFolder = fileURLToPath(
      new URL("../drizzle", import.meta.url),
    );
    const migrations = (await readdir(migrationsFolder))
      .filter((name) => /^\d{4}_.+\.sql$/.test(name))
      .sort();
    for (const migration of migrations) {
      await database.exec(
        await readFile(`${migrationsFolder}/${migration}`, "utf8"),
      );
    }
  });

  afterEach(async () => database.close());

  test("installs unaccent with the Spanish normalization used by search", async () => {
    const extension = await database.query<{ installed: boolean }>(`
      SELECT EXISTS (
        SELECT 1 FROM pg_extension WHERE extname = 'unaccent'
      ) AS installed
    `);
    const normalized = await database.query<{ value: string }>(`
      SELECT public.unaccent('public.unaccent'::regdictionary, 'Señor Álvarez') AS value
    `);

    expect(extension.rows).toEqual([{ installed: true }]);
    expect(normalized.rows).toEqual([{ value: "Senor Alvarez" }]);
  });
});
