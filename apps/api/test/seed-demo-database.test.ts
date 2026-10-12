import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import type { PGlite } from "@electric-sql/pglite";
import { createTestPGlite } from "./support/create-test-pglite";
import { count, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { afterEach, describe, expect, test } from "vitest";

import * as schema from "../src/db/schema";
import {
  account,
  project,
  projectEvent,
  projectTask,
  legalCases,
  caseUpdates,
  caseEvents,
  user,
} from "../src/db/schema";
import { buildDemoSeedData } from "../src/seed/demo-seed-data";
import {
  assertLocalSeedEnvironment,
  seedDemoDatabase,
  type DemoSeedDatabase,
} from "../src/seed/seed-demo-database";

describe("demo seed database", () => {
  let client: PGlite | undefined;

  afterEach(async () => {
    await client?.close();
  });

  test("refuses production before database work", () => {
    expect(() => assertLocalSeedEnvironment("production")).toThrow(
      "Demo seed is disabled in production.",
    );
    expect(() => assertLocalSeedEnvironment("development")).not.toThrow();
    expect(() => assertLocalSeedEnvironment(undefined)).not.toThrow();
  });

  test("seeds twice without duplicates or unrelated-row changes", async () => {
    client = createTestPGlite();
    const database = drizzle(client, { schema });
    const migrationsFolder = fileURLToPath(
      new URL("../drizzle", import.meta.url),
    );
    const migrationFiles = (await readdir(migrationsFolder))
      .filter((name) => /^\d{4}_.+\.sql$/.test(name))
      .sort();
    for (const migrationFile of migrationFiles) {
      await client.exec(
        await readFile(`${migrationsFolder}/${migrationFile}`, "utf8"),
      );
    }
    const unrelatedCreatedAt = new Date("2026-01-01T00:00:00.000Z");
    await database.insert(user).values({
      id: "unrelated-user",
      name: "Existing User",
      email: "existing@example.test",
      emailVerified: true,
      alias: "EU",
      createdAt: unrelatedCreatedAt,
      updatedAt: unrelatedCreatedAt,
    });

    const fixture = buildDemoSeedData("2026-08-07");
    const seedDatabase = database as unknown as DemoSeedDatabase;
    const first = await seedDemoDatabase(seedDatabase, fixture, "demo-hash");
    const second = await seedDemoDatabase(seedDatabase, fixture, "other-hash");

    expect(second).toEqual(first);
    expect(first).toMatchObject({
      users: 2,
      clients: 2,
      projects: 4,
      projectEvents: 4,
      tasks: 5,
      cases: 2,
      caseUpdates: 2,
      caseEvents: 3,
    });
    expect(await database.select({ value: count() }).from(user)).toEqual([
      { value: 3 },
    ]);
    expect(await database.select({ value: count() }).from(project)).toEqual([
      { value: 4 },
    ]);
    expect(
      await database.select({ value: count() }).from(projectEvent),
    ).toEqual([{ value: 4 }]);
    expect(
      await database
        .select({ projectId: projectEvent.projectId, date: projectEvent.date })
        .from(projectEvent),
    ).toEqual(
      expect.arrayContaining([
        { projectId: "demo-project-written", date: "2026-08-09" },
        { projectId: "demo-project-consultation", date: "2026-08-25" },
        { projectId: "demo-project-oral", date: "2026-08-07" },
        { projectId: "demo-project-oral", date: "2026-08-11" },
      ]),
    );
    expect(await database.select({ value: count() }).from(projectTask)).toEqual(
      [{ value: 5 }],
    );
    expect(await database.select({ value: count() }).from(legalCases)).toEqual([
      { value: 2 },
    ]);
    expect(await database.select({ value: count() }).from(caseUpdates)).toEqual(
      [{ value: 2 }],
    );
    expect(await database.select({ value: count() }).from(caseEvents)).toEqual([
      { value: 3 },
    ]);
    expect(
      await database
        .select({ password: account.password })
        .from(account)
        .where(eq(account.id, "demo-account-credential")),
    ).toEqual([{ password: "demo-hash" }]);
    expect(
      await database
        .select({ name: user.name, updatedAt: user.updatedAt })
        .from(user)
        .where(eq(user.id, "unrelated-user")),
    ).toEqual([{ name: "Existing User", updatedAt: unrelatedCreatedAt }]);
  }, 30_000);
});
