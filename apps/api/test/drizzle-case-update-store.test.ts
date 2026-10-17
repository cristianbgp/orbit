import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import type { PGlite } from "@electric-sql/pglite";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { afterEach, beforeEach, describe, expect, test } from "vitest";

import * as schema from "../src/db/schema";
import {
  caseActivities,
  caseUpdates,
  client,
  legalCases,
  member,
  organization,
  user,
} from "../src/db/schema";
import { createDrizzleCaseUpdateStore } from "../src/case-updates/drizzle-case-update-store";
import { createTestPGlite } from "./support/create-test-pglite";

const migrationsFolder = fileURLToPath(new URL("../drizzle", import.meta.url));
const actor = { userId: "user-1", organizationId: "org-1" };

describe("Drizzle case update store", () => {
  let pg: PGlite;
  let database: ReturnType<typeof drizzle<typeof schema>>;

  beforeEach(async () => {
    pg = createTestPGlite();
    database = drizzle(pg, { schema });
    const migrations = (await readdir(migrationsFolder))
      .filter((name) => /^\d{4}_.+\.sql$/.test(name))
      .sort();
    for (const migration of migrations) {
      await pg.exec(await readFile(`${migrationsFolder}/${migration}`, "utf8"));
    }

    const now = new Date("2026-09-03T12:00:00.000Z");
    await database.insert(user).values([
      {
        id: "user-1",
        name: "Cristian Granda",
        email: "cristian@orbit.test",
        emailVerified: true,
        alias: "CG",
        avatarColor: "#4057ed",
        createdAt: now,
        updatedAt: now,
      },
      {
        id: "user-2",
        name: "Ana Torres",
        email: "ana@orbit.test",
        emailVerified: true,
        createdAt: now,
        updatedAt: now,
      },
    ]);
    await database.insert(organization).values([
      { id: "org-1", name: "Orbit", slug: "orbit", createdAt: now },
      { id: "org-2", name: "Otro", slug: "otro", createdAt: now },
    ]);
    await database.insert(member).values({
      id: "member-1",
      organizationId: "org-1",
      userId: "user-1",
      role: "member",
      createdAt: now,
    });
    await database.insert(client).values([
      {
        id: "client-1",
        organizationId: "org-1",
        type: "company",
        name: "Cliente",
      },
      {
        id: "client-2",
        organizationId: "org-2",
        type: "company",
        name: "Otro cliente",
      },
    ]);
    await database.insert(legalCases).values([
      {
        id: "case-1",
        organizationId: "org-1",
        clientId: "client-1",
        identification: "Caso principal",
        createdByUserId: "user-1",
      },
      {
        id: "case-3",
        organizationId: "org-1",
        clientId: "client-1",
        identification: "Segundo caso",
        createdByUserId: "user-1",
      },
      {
        id: "case-archived",
        organizationId: "org-1",
        clientId: "client-1",
        identification: "Caso archivado",
        createdByUserId: "user-1",
        archivedAt: new Date("2026-09-01T12:00:00.000Z"),
      },
      {
        id: "case-2",
        organizationId: "org-2",
        clientId: "client-2",
        identification: "Caso ajeno",
      },
    ]);
  }, 30_000);

  afterEach(async () => pg.close());

  test("creates, edits, archives, and restores updates with immutable activity", async () => {
    const activityIds = [
      "activity-1",
      "activity-2",
      "activity-3",
      "activity-4",
    ];
    const store = createDrizzleCaseUpdateStore(
      database as never,
      () => activityIds.shift() ?? "unexpected",
    );

    const created = await store.create(actor, "case-1", "update-1", {
      date: "2026-08-11",
      description: "Recurso de apelación del cliente",
      kind: "update",
    });
    expect(created).toMatchObject({
      status: "created",
      update: {
        id: "update-1",
        creator: { alias: "CG", activeStudioMember: true },
      },
    });
    if (created.status !== "created") throw new Error("Expected creation");

    const changed = await store.update(
      actor,
      "case-1",
      "update-1",
      {
        date: "2026-08-21",
        description: "Sentencia de primera instancia",
      },
      created.update.updatedAt.toISOString(),
    );
    expect(changed).toMatchObject({
      status: "updated",
      update: { date: "2026-08-21" },
    });
    if (!("update" in changed)) throw new Error("Expected changed update");

    await expect(
      store.update(
        actor,
        "case-1",
        "update-1",
        { description: "Cambio obsoleto" },
        created.update.updatedAt.toISOString(),
      ),
    ).resolves.toEqual({ status: "conflict" });

    const archived = await store.archive(
      actor,
      "case-1",
      "update-1",
      changed.update.updatedAt.toISOString(),
    );
    expect(archived).toMatchObject({
      status: "updated",
      update: { archivedAt: expect.any(Date) },
    });
    if (!("update" in archived)) throw new Error("Expected archived update");

    await expect(
      store.archive(
        actor,
        "case-1",
        "update-1",
        archived.update.updatedAt.toISOString(),
      ),
    ).resolves.toMatchObject({ status: "unchanged" });

    const restored = await store.restore(
      actor,
      "case-1",
      "update-1",
      archived.update.updatedAt.toISOString(),
    );
    expect(restored).toMatchObject({
      status: "updated",
      update: { archivedAt: null },
    });

    const activities = await database
      .select({ type: caseActivities.type, details: caseActivities.details })
      .from(caseActivities);
    expect(activities).toEqual([
      {
        type: "case.update_created",
        details: {
          updateId: "update-1",
          date: "2026-08-11",
          description: "Recurso de apelación del cliente",
          kind: "update",
        },
      },
      {
        type: "case.update_changed",
        details: {
          updateId: "update-1",
          date: "2026-08-11",
          description: "Recurso de apelación del cliente",
          kind: "update",
          newDate: "2026-08-21",
          newDescription: "Sentencia de primera instancia",
          newKind: "update",
        },
      },
      {
        type: "case.update_archived",
        details: {
          updateId: "update-1",
          date: "2026-08-21",
          description: "Sentencia de primera instancia",
          kind: "update",
        },
      },
      {
        type: "case.update_restored",
        details: {
          updateId: "update-1",
          date: "2026-08-21",
          description: "Sentencia de primera instancia",
          kind: "update",
        },
      },
    ]);
  }, 30_000);

  test("lists active and archived updates newest first with stable pagination", async () => {
    const store = createDrizzleCaseUpdateStore(database as never);
    const first = await store.create(actor, "case-1", "update-a", {
      date: "2026-08-11",
      description: "Primera novedad",
      kind: "update",
    });
    const second = await store.create(actor, "case-1", "update-b", {
      date: "2026-08-21",
      description: "Segunda novedad",
      kind: "update",
    });
    if (first.status !== "created" || second.status !== "created") {
      throw new Error("Expected fixtures");
    }
    await store.archive(
      actor,
      "case-1",
      "update-a",
      first.update.updatedAt.toISOString(),
    );

    await expect(
      store.list("org-1", "case-1", {
        status: "active",
        page: 1,
        pageSize: 10,
      }),
    ).resolves.toMatchObject({
      updates: [{ id: "update-b" }],
      total: 1,
    });
    await expect(
      store.list("org-1", "case-1", {
        status: "archived",
        page: 1,
        pageSize: 10,
      }),
    ).resolves.toMatchObject({
      updates: [{ id: "update-a" }],
      total: 1,
    });
  }, 30_000);

  test("hides cross-tenant cases and keeps archived parents read-only", async () => {
    const store = createDrizzleCaseUpdateStore(database as never);

    await expect(
      store.list("org-1", "case-2", {
        status: "active",
        page: 1,
        pageSize: 10,
      }),
    ).resolves.toBeNull();
    await expect(
      store.create(actor, "case-2", "update-foreign", {
        date: "2026-08-21",
        description: "No permitido",
        kind: "update",
      }),
    ).resolves.toEqual({ status: "not_found" });

    await database
      .update(legalCases)
      .set({ archivedAt: new Date("2026-09-03T13:00:00.000Z") })
      .where(eq(legalCases.id, "case-1"));
    await expect(
      store.create(actor, "case-1", "update-archived", {
        date: "2026-08-21",
        description: "No permitido",
        kind: "update",
      }),
    ).resolves.toEqual({ status: "case_archived" });
  }, 30_000);

  test("lists novelties and backgrounds independently", async () => {
    const store = createDrizzleCaseUpdateStore(database as never);
    await store.create(actor, "case-1", "update-news", {
      date: "2026-09-01",
      description: "Novedad reciente",
      kind: "update",
    });
    await store.create(actor, "case-1", "update-background", {
      date: "2026-08-01",
      description: "Antecedente histórico",
      kind: "background",
    });

    await expect(
      store.list("org-1", "case-1", {
        status: "active",
        kind: "background",
        page: 1,
        pageSize: 10,
      }),
    ).resolves.toMatchObject({
      updates: [{ id: "update-background", kind: "background" }],
      total: 1,
    });
  }, 30_000);

  test("moves one update to background and records the classification change", async () => {
    const store = createDrizzleCaseUpdateStore(database as never);
    const created = await store.create(actor, "case-1", "update-1", {
      date: "2026-08-21",
      description: "Sentencia",
      kind: "update",
    });
    if (created.status !== "created") throw new Error("Expected creation");

    const changed = await store.update(
      actor,
      "case-1",
      "update-1",
      { kind: "background" },
      created.update.updatedAt.toISOString(),
    );

    expect(changed).toMatchObject({
      status: "updated",
      update: { kind: "background" },
    });
    const activity = await database
      .select({ type: caseActivities.type, details: caseActivities.details })
      .from(caseActivities)
      .where(eq(caseActivities.type, "case.update_changed"));
    expect(activity).toEqual([
      {
        type: "case.update_changed",
        details: expect.objectContaining({
          kind: "update",
          newKind: "background",
        }),
      },
    ]);
  }, 30_000);

  test("moves organizational novelties and records one activity per affected case", async () => {
    const store = createDrizzleCaseUpdateStore(database as never);
    await database.insert(caseUpdates).values([
      {
        id: "update-active-a",
        organizationId: "org-1",
        caseId: "case-1",
        date: "2026-08-01",
        description: "Primera",
      },
      {
        id: "update-active-b",
        organizationId: "org-1",
        caseId: "case-1",
        date: "2026-08-02",
        description: "Segunda",
      },
      {
        id: "update-second-case",
        organizationId: "org-1",
        caseId: "case-3",
        date: "2026-08-03",
        description: "Tercera",
      },
      {
        id: "update-archived-case",
        organizationId: "org-1",
        caseId: "case-archived",
        date: "2026-08-04",
        description: "Caso archivado",
      },
      {
        id: "update-foreign-case",
        organizationId: "org-2",
        caseId: "case-2",
        date: "2026-08-05",
        description: "Otro estudio",
      },
      {
        id: "update-background",
        organizationId: "org-1",
        caseId: "case-1",
        date: "2026-07-01",
        description: "Ya era antecedente",
        kind: "background",
      },
      {
        id: "update-archived",
        organizationId: "org-1",
        caseId: "case-1",
        date: "2026-06-01",
        description: "Archivada",
        archivedAt: new Date("2026-09-01T12:00:00.000Z"),
      },
    ]);

    await expect(store.previewMoveAllToBackground("org-1")).resolves.toEqual({
      movedCount: 3,
      caseCount: 2,
    });
    const result = await store.moveAllToBackground(actor);

    expect(result).toEqual({
      status: "updated",
      movedCount: 3,
      caseCount: 2,
    });
    const rows = await database
      .select({ id: caseUpdates.id, kind: caseUpdates.kind })
      .from(caseUpdates);
    expect(rows).toEqual(
      expect.arrayContaining([
        { id: "update-active-a", kind: "background" },
        { id: "update-active-b", kind: "background" },
        { id: "update-second-case", kind: "background" },
        { id: "update-archived-case", kind: "update" },
        { id: "update-foreign-case", kind: "update" },
        { id: "update-background", kind: "background" },
        { id: "update-archived", kind: "update" },
      ]),
    );
    const activities = await database
      .select({ type: caseActivities.type, details: caseActivities.details })
      .from(caseActivities);
    expect(activities).toEqual(
      expect.arrayContaining([
        {
          type: "case.updates_moved_to_background",
          details: { count: "2" },
        },
        {
          type: "case.updates_moved_to_background",
          details: { count: "1" },
        },
      ]),
    );
  }, 30_000);
});
