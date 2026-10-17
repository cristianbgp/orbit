import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import type { PGlite } from "@electric-sql/pglite";
import { createTestPGlite } from "./support/create-test-pglite";
import { drizzle } from "drizzle-orm/pglite";
import { afterEach, beforeEach, describe, expect, test } from "vitest";

import * as schema from "../src/db/schema";
import {
  client,
  member,
  organization,
  project,
  projectActivity,
  user,
} from "../src/db/schema";
import { createDrizzleDashboardStore } from "../src/dashboard/drizzle-dashboard-store";

describe("Drizzle dashboard activity store", () => {
  let clientDatabase: PGlite;
  let database: ReturnType<typeof drizzle<typeof schema>>;

  beforeEach(async () => {
    clientDatabase = createTestPGlite();
    database = drizzle(clientDatabase, { schema });
    const migrationsFolder = fileURLToPath(
      new URL("../drizzle", import.meta.url),
    );
    const migrations = (await readdir(migrationsFolder))
      .filter((name) => /^\d{4}_.+\.sql$/.test(name))
      .sort();
    for (const migration of migrations) {
      await clientDatabase.exec(
        await readFile(`${migrationsFolder}/${migration}`, "utf8"),
      );
    }

    const timestamp = new Date("2026-08-10T10:00:00.000Z");
    await database.insert(organization).values([
      {
        id: "org-1",
        name: "Orbit Estudio",
        slug: "orbit-estudio",
        timeZone: "America/Lima",
        createdAt: timestamp,
      },
      {
        id: "org-2",
        name: "Otro estudio",
        slug: "otro-estudio",
        createdAt: timestamp,
      },
    ]);
    await database.insert(user).values({
      id: "user-1",
      name: "Cristian Granda",
      email: "cristian@orbit.test",
      emailVerified: true,
      alias: "CG",
      createdAt: timestamp,
      updatedAt: timestamp,
    });
    await database.insert(member).values({
      id: "member-1",
      organizationId: "org-1",
      userId: "user-1",
      role: "member",
      createdAt: timestamp,
    });
    await database.insert(client).values([
      {
        id: "client-1",
        organizationId: "org-1",
        type: "company",
        name: "Cliente Orbit",
      },
      {
        id: "client-2",
        organizationId: "org-2",
        type: "company",
        name: "Cliente externo",
      },
    ]);

    const baseProject = {
      organizationId: "org-1",
      clientId: "client-1",
      name: "Proyecto",
      type: "written_submission" as const,
      status: "active" as const,
      startDate: "2026-08-01",
      endDate: "2026-08-31",
    };
    await database.insert(project).values([
      { ...baseProject, id: "p-active" },
      { ...baseProject, id: "p-draft", status: "draft" },
      { ...baseProject, id: "p-completed", status: "completed" },
      { ...baseProject, id: "p-archived", archivedAt: timestamp },
      {
        ...baseProject,
        id: "p-other-tenant",
        organizationId: "org-2",
        clientId: "client-2",
      },
    ]);

    await database.insert(projectActivity).values([
      ...Array.from({ length: 6 }, (_, index) => ({
        id: `activity-${index + 1}`,
        organizationId: "org-1",
        projectId: "p-active",
        type: "project.details_changed" as const,
        actorUserId: index === 4 ? null : "user-1",
        actorNameSnapshot: index === 4 ? "Miembro retirado" : "Cristian Granda",
        subjectUserId: null,
        subjectNameSnapshot: null,
        details: {},
        createdAt: new Date(`2026-08-10T1${index}:00:00.000Z`),
      })),
      {
        id: "activity-draft",
        organizationId: "org-1",
        projectId: "p-draft",
        type: "project.created",
        actorUserId: "user-1",
        actorNameSnapshot: "Cristian Granda",
        details: {},
        createdAt: new Date("2026-08-10T20:00:00.000Z"),
      },
      {
        id: "activity-other",
        organizationId: "org-2",
        projectId: "p-other-tenant",
        type: "project.created",
        actorUserId: null,
        actorNameSnapshot: "Otro usuario",
        details: {},
        createdAt: new Date("2026-08-10T21:00:00.000Z"),
      },
      {
        id: "activity-completed",
        organizationId: "org-1",
        projectId: "p-completed",
        type: "project.status_changed",
        actorUserId: "user-1",
        actorNameSnapshot: "Cristian Granda",
        details: { previousStatus: "active", newStatus: "completed" },
        createdAt: new Date("2026-08-10T22:00:00.000Z"),
      },
      {
        id: "activity-archived",
        organizationId: "org-1",
        projectId: "p-archived",
        type: "project.archived",
        actorUserId: "user-1",
        actorNameSnapshot: "Cristian Granda",
        details: {},
        createdAt: new Date("2026-08-10T23:00:00.000Z"),
      },
    ]);
  }, 30_000);

  afterEach(async () => {
    await clientDatabase.close();
  });

  test("loads member timezone only for the scoped membership", async () => {
    const store = createDrizzleDashboardStore(database as never);

    await expect(store.findMemberContext("user-1", "org-1")).resolves.toEqual({
      timeZone: "America/Lima",
    });
    await expect(
      store.findMemberContext("user-1", "org-2"),
    ).resolves.toBeNull();
  });

  test("paginates all studio activity with stable tuple cursors and tenant isolation", async () => {
    const store = createDrizzleDashboardStore(database as never);

    const first = await store.listActivity("org-1", {
      limit: 4,
      cursor: null,
    });

    expect(first.hasMore).toBe(true);
    expect(first.activities.map(({ id }) => id)).toEqual([
      "activity-archived",
      "activity-completed",
      "activity-draft",
      "activity-6",
    ]);
    expect(first.activities[0]).toMatchObject({
      project: {
        id: "p-archived",
        name: "Proyecto",
        status: "active",
        archivedAt: new Date("2026-08-10T10:00:00.000Z"),
      },
      actor: {
        userId: "user-1",
        alias: "CG",
        nameSnapshot: "Cristian Granda",
        activeStudioMember: true,
        linkable: true,
      },
    });
    expect(first.activities[1]).toMatchObject({
      project: {
        id: "p-completed",
        name: "Proyecto",
        status: "completed",
        archivedAt: null,
      },
    });

    const second = await store.listActivity("org-1", {
      limit: 3,
      cursor: {
        createdAt: new Date("2026-08-10T20:00:00.000Z"),
        id: "activity-draft",
      },
    });
    expect(second.activities.map(({ id }) => id)).toEqual([
      "activity-6",
      "activity-5",
      "activity-4",
    ]);
    expect(second.activities[1]).toMatchObject({
      actor: {
        userId: null,
        alias: null,
        nameSnapshot: "Miembro retirado",
        activeStudioMember: false,
        linkable: false,
      },
    });
    expect(
      JSON.stringify([...first.activities, ...second.activities]),
    ).not.toContain("activity-other");
  }, 30_000);

  test("uses activity id as the stable cursor tie breaker", async () => {
    await database.insert(projectActivity).values([
      {
        id: "activity-tie-a",
        organizationId: "org-1",
        projectId: "p-active",
        type: "project.created",
        actorUserId: "user-1",
        actorNameSnapshot: "Cristian Granda",
        details: {},
        createdAt: new Date("2026-08-11T00:00:00.000Z"),
      },
      {
        id: "activity-tie-b",
        organizationId: "org-1",
        projectId: "p-active",
        type: "project.created",
        actorUserId: "user-1",
        actorNameSnapshot: "Cristian Granda",
        details: {},
        createdAt: new Date("2026-08-11T00:00:00.000Z"),
      },
    ]);
    const store = createDrizzleDashboardStore(database as never);

    const first = await store.listActivity("org-1", {
      limit: 1,
      cursor: null,
    });
    const second = await store.listActivity("org-1", {
      limit: 1,
      cursor: {
        createdAt: new Date("2026-08-11T00:00:00.000Z"),
        id: "activity-tie-b",
      },
    });

    expect(first.activities.map(({ id }) => id)).toEqual(["activity-tie-b"]);
    expect(second.activities.map(({ id }) => id)).toEqual(["activity-tie-a"]);
  }, 30_000);
});
