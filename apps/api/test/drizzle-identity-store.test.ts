import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import type { PGlite } from "@electric-sql/pglite";
import { createTestPGlite } from "./support/create-test-pglite";
import { drizzle } from "drizzle-orm/pglite";
import { afterEach, beforeEach, describe, expect, test } from "vitest";

import * as schema from "../src/db/schema";
import { member, organization, user } from "../src/db/schema";
import { createDrizzleIdentityStore } from "../src/identity/drizzle-identity-store";

describe("Drizzle identity store", () => {
  let client: PGlite;
  let database: ReturnType<typeof drizzle<typeof schema>>;

  beforeEach(async () => {
    client = createTestPGlite();
    database = drizzle(client, { schema });
    const folder = fileURLToPath(new URL("../drizzle", import.meta.url));
    for (const migration of (await readdir(folder))
      .filter((name) => /^\d{4}_.+\.sql$/.test(name))
      .sort()) {
      await client.exec(await readFile(`${folder}/${migration}`, "utf8"));
    }
    const now = new Date("2026-08-14T12:00:00.000Z");
    await database.insert(organization).values([
      { id: "org-1", name: "Orbit", slug: "orbit", createdAt: now },
      { id: "org-2", name: "Other", slug: "other", createdAt: now },
    ]);
    await database.insert(user).values([
      {
        id: "u-1",
        name: "Ana Muñoz",
        email: "ana@orbit.pe",
        emailVerified: true,
        alias: "AT",
        createdAt: now,
        updatedAt: now,
      },
      {
        id: "u-2",
        name: "Diego Salazar",
        email: "diego@orbit.pe",
        emailVerified: true,
        alias: "DS",
        createdAt: now,
        updatedAt: now,
      },
      {
        id: "u-3",
        name: "Ana Externa",
        email: "ana@other.pe",
        emailVerified: true,
        alias: "AX",
        createdAt: now,
        updatedAt: now,
      },
    ]);
    await database.insert(member).values([
      {
        id: "m-1",
        organizationId: "org-1",
        userId: "u-1",
        role: "owner",
        position: "partner",
        createdAt: now,
      },
      {
        id: "m-2",
        organizationId: "org-1",
        userId: "u-2",
        role: "member",
        position: "junior",
        createdAt: now,
      },
      {
        id: "m-3",
        organizationId: "org-2",
        userId: "u-3",
        role: "owner",
        position: "partner",
        createdAt: now,
      },
    ]);
  });

  afterEach(async () => client.close());

  test("shares tenant-safe search and position predicates across rows and totals", async () => {
    const store = createDrizzleIdentityStore(database as never);

    await expect(
      store.listMembers("org-1", {
        page: 1,
        pageSize: 25,
        q: "ana",
        position: "partner",
      }),
    ).resolves.toMatchObject({
      members: [{ userId: "u-1", position: "partner" }],
      total: 1,
    });
    await expect(
      store.listMembers("org-1", { page: 1, pageSize: 25, q: "munoz" }),
    ).resolves.toMatchObject({
      members: [{ userId: "u-1" }],
      total: 1,
    });
    await expect(
      store.listMembers("org-1", { page: 1, pageSize: 25, q: "@orbit.pe" }),
    ).resolves.toMatchObject({ total: 2 });
    await expect(
      store.listMembers("org-1", { page: 1, pageSize: 25, q: "DS" }),
    ).resolves.toMatchObject({
      members: [expect.objectContaining({ userId: "u-2" })],
      total: 1,
    });
  });
});
