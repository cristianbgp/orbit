import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import type { PGlite } from "@electric-sql/pglite";
import { createTestPGlite } from "./support/create-test-pglite";
import { drizzle } from "drizzle-orm/pglite";
import { afterEach, beforeEach, describe, expect, test } from "vitest";

import * as schema from "../src/db/schema";
import { featureFlag, member, organization, user } from "../src/db/schema";
import { createDrizzleFeatureFlagStore } from "../src/feature-flags/drizzle-feature-flag-store";

describe("Drizzle feature flag store", () => {
  let pg: PGlite;
  let db: ReturnType<typeof drizzle<typeof schema>>;
  const timestamp = new Date("2026-08-13T10:00:00.000Z");

  beforeEach(async () => {
    pg = createTestPGlite();
    db = drizzle(pg, { schema });
    const folder = fileURLToPath(new URL("../drizzle", import.meta.url));
    for (const migration of (await readdir(folder))
      .filter((name) => /^\d{4}_.+\.sql$/.test(name))
      .sort()) {
      await pg.exec(await readFile(`${folder}/${migration}`, "utf8"));
    }

    await db.insert(organization).values([
      {
        id: "org-1",
        name: "Orbit Uno",
        slug: "orbit-uno",
        createdAt: timestamp,
      },
      {
        id: "org-2",
        name: "Orbit Dos",
        slug: "orbit-dos",
        createdAt: timestamp,
      },
    ]);
    await db.insert(user).values([
      {
        id: "user-1",
        name: "Ana Uno",
        email: "ana@uno.test",
        emailVerified: true,
        alias: "AU",
        createdAt: timestamp,
        updatedAt: timestamp,
      },
      {
        id: "user-2",
        name: "Ana Dos",
        email: "ana@dos.test",
        emailVerified: true,
        alias: "AD",
        createdAt: timestamp,
        updatedAt: timestamp,
      },
    ]);
    await db.insert(member).values([
      {
        id: "member-1",
        organizationId: "org-1",
        userId: "user-1",
        role: "member",
        createdAt: timestamp,
      },
      {
        id: "member-2",
        organizationId: "org-2",
        userId: "user-2",
        role: "member",
        createdAt: timestamp,
      },
    ]);
    await db.insert(featureFlag).values([
      { key: "orbit_help_assistant", organizationId: null, enabled: false },
      {
        key: "orbit_help_assistant",
        organizationId: "org-1",
        enabled: true,
      },
      {
        key: "orbit_help_assistant",
        organizationId: "org-2",
        enabled: false,
      },
      { key: "unknown_flag", organizationId: "org-1", enabled: true },
    ]);
  });

  afterEach(async () => {
    await pg.close();
  });

  test("checks membership inside the requested organization", async () => {
    const store = createDrizzleFeatureFlagStore(db as never);

    await expect(store.hasMembership("user-1", "org-1")).resolves.toBe(true);
    await expect(store.hasMembership("user-1", "org-2")).resolves.toBe(false);
  });

  test("returns only global and requested organization candidates", async () => {
    const store = createDrizzleFeatureFlagStore(db as never);

    await expect(store.listCandidates("org-1")).resolves.toEqual([
      {
        key: "orbit_help_assistant",
        organizationId: null,
        enabled: false,
      },
      {
        key: "orbit_help_assistant",
        organizationId: "org-1",
        enabled: true,
      },
      { key: "unknown_flag", organizationId: "org-1", enabled: true },
    ]);
  });
});
