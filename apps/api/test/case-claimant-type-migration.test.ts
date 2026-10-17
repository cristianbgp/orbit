import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import type { PGlite } from "@electric-sql/pglite";
import { afterEach, describe, expect, test } from "vitest";

import { createTestPGlite } from "./support/create-test-pglite";

const migrationsFolder = fileURLToPath(new URL("../drizzle", import.meta.url));

describe("case claimant type migration", () => {
  let database: PGlite | undefined;

  afterEach(async () => database?.close());

  test("preserves claimants only for judicial cases", async () => {
    database = createTestPGlite();
    const migrations = (await readdir(migrationsFolder))
      .filter((name) => /^\d{4}_.+\.sql$/.test(name))
      .sort();

    for (const migration of migrations.filter((name) => name < "0024_")) {
      await database.exec(
        await readFile(`${migrationsFolder}/${migration}`, "utf8"),
      );
    }

    await database.exec(`
      insert into organization (id, name, slug, created_at)
      values ('org-1', 'Estudio', 'estudio', now());
      insert into client (id, organization_id, type, name)
      values ('client-1', 'org-1', 'company', 'Cliente de prueba');
      insert into legal_case (
        id, organization_id, client_id, identification, type, claimant
      ) values
        ('case-sunat', 'org-1', 'client-1', 'Caso SUNAT', 'judicial', ' Sunat '),
        ('case-client', 'org-1', 'client-1', 'Caso cliente', 'judicial', 'Nombre anterior'),
        ('case-administrative', 'org-1', 'client-1', 'Caso administrativo', 'administrative', 'Sunat');
    `);

    await database.exec(
      await readFile(`${migrationsFolder}/0024_case_claimant_type.sql`, "utf8"),
    );

    const result = await database.query<{
      id: string;
      claimant_type: string | null;
    }>(`select id, claimant_type from legal_case order by id`);
    expect(result.rows).toEqual([
      { id: "case-administrative", claimant_type: null },
      { id: "case-client", claimant_type: "client" },
      { id: "case-sunat", claimant_type: "sunat" },
    ]);

    const columns = await database.query<{ column_name: string }>(`
      select column_name
      from information_schema.columns
      where table_name = 'legal_case'
        and column_name in ('claimant', 'claimant_type')
      order by column_name
    `);
    expect(columns.rows).toEqual([{ column_name: "claimant_type" }]);
  }, 30_000);
});
