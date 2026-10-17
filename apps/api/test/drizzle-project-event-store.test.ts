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
  projectEvent,
  user,
} from "../src/db/schema";
import { createDrizzleProjectEventStore } from "../src/project-events/drizzle-project-event-store";

const actor = { userId: "user-1", organizationId: "org-1" };

describe("Drizzle project event store", () => {
  let pg: PGlite;
  let database: ReturnType<typeof drizzle<typeof schema>>;

  beforeEach(async () => {
    pg = createTestPGlite();
    database = drizzle(pg, { schema });
    const folder = fileURLToPath(new URL("../drizzle", import.meta.url));
    for (const file of (await readdir(folder))
      .filter((name) => /^\d{4}_.+\.sql$/.test(name))
      .sort()) {
      await pg.exec(await readFile(`${folder}/${file}`, "utf8"));
    }
    const now = new Date("2026-08-12T10:00:00Z");
    await database.insert(user).values({
      id: "user-1",
      name: "Cristian",
      email: "cristian@orbit.test",
      emailVerified: true,
      alias: "CG",
      createdAt: now,
      updatedAt: now,
    });
    await database.insert(organization).values({
      id: "org-1",
      name: "Orbit",
      slug: "orbit",
      createdAt: now,
    });
    await database.insert(member).values({
      id: "member-1",
      organizationId: "org-1",
      userId: "user-1",
      role: "member",
      createdAt: now,
    });
    await database.insert(client).values({
      id: "client-1",
      organizationId: "org-1",
      type: "company",
      name: "Cliente",
    });
    await database.insert(project).values({
      id: "project-1",
      organizationId: "org-1",
      clientId: "client-1",
      name: "Proyecto",
      type: "consultation",
      status: "active",
      startDate: "2026-08-12",
      endDate: "2026-08-20",
    });
    await database.delete(projectEvent);
  }, 30_000);

  afterEach(async () => pg.close());

  test("creates, lists, updates, and deletes legal events with immutable activity", async () => {
    const ids = ["activity-created", "activity-updated", "activity-deleted"];
    const store = createDrizzleProjectEventStore(
      database as never,
      () => ids.shift() ?? "unexpected",
    );

    await expect(
      store.create(actor, "project-1", "event-1", {
        title: "Audiencia",
        type: "legal",
        date: "2026-08-25",
        description: null,
      }),
    ).resolves.toMatchObject({
      status: "created",
      event: { id: "event-1", date: "2026-08-25" },
    });
    await expect(
      store.create(actor, "project-1", "event-before", {
        title: "Inválido",
        type: "legal",
        date: "2026-08-11",
        description: null,
      }),
    ).resolves.toEqual({ status: "invalid_date" });
    await expect(
      store.list("org-1", "project-1", { page: 1, pageSize: 25 }),
    ).resolves.toMatchObject({
      events: [{ id: "event-1" }],
      total: 1,
    });
    await expect(
      store.update(actor, "project-1", "event-1", {
        title: "Audiencia reprogramada",
        date: "2026-08-28",
      }),
    ).resolves.toMatchObject({
      status: "updated",
      event: { title: "Audiencia reprogramada", date: "2026-08-28" },
    });
    await expect(store.remove(actor, "project-1", "event-1")).resolves.toEqual({
      status: "removed",
    });
    await expect(database.select().from(projectEvent)).resolves.toEqual([]);
    await expect(
      database
        .select({
          type: projectActivity.type,
          details: projectActivity.details,
        })
        .from(projectActivity),
    ).resolves.toEqual(
      expect.arrayContaining([
        {
          type: "project.event_created",
          details: {
            eventId: "event-1",
            title: "Audiencia",
            type: "legal",
            date: "2026-08-25",
            description: null,
          },
        },
        {
          type: "project.event_updated",
          details: {
            eventId: "event-1",
            title: "Audiencia",
            type: "legal",
            date: "2026-08-25",
            description: null,
            newTitle: "Audiencia reprogramada",
            newType: "legal",
            newDate: "2026-08-28",
            newDescription: null,
          },
        },
        {
          type: "project.event_deleted",
          details: {
            eventId: "event-1",
            title: "Audiencia reprogramada",
            type: "legal",
            date: "2026-08-28",
            description: null,
          },
        },
      ]),
    );
  }, 30_000);

  test("keeps archived projects read-only", async () => {
    await database.update(project).set({ archivedAt: new Date() });
    const store = createDrizzleProjectEventStore(database as never);

    await expect(
      store.create(actor, "project-1", "event-1", {
        title: "Audiencia",
        type: "legal",
        date: "2026-08-25",
        description: null,
      }),
    ).resolves.toEqual({ status: "project_archived" });
  }, 30_000);
});
