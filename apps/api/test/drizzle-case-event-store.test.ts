import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import type { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { afterEach, beforeEach, describe, expect, test } from "vitest";

import * as schema from "../src/db/schema";
import {
  caseActivities,
  caseAssignments,
  caseEvents,
  client,
  legalCases,
  member,
  organization,
  user,
} from "../src/db/schema";
import { createDrizzleCaseEventStore } from "../src/case-events/drizzle-case-event-store";
import { createTestPGlite } from "./support/create-test-pglite";

const actor = { userId: "user-1", organizationId: "org-1" };

describe("Drizzle case event store", () => {
  let pg: PGlite;
  let database: ReturnType<typeof drizzle<typeof schema>>;

  beforeEach(async () => {
    pg = createTestPGlite();
    database = drizzle(pg, { schema });
    const folder = fileURLToPath(new URL("../drizzle", import.meta.url));
    const migrations = (await readdir(folder))
      .filter((name) => /^\d{4}_.+\.sql$/.test(name))
      .sort();
    for (const migration of migrations) {
      await pg.exec(await readFile(`${folder}/${migration}`, "utf8"));
    }

    const now = new Date("2026-09-03T10:00:00Z");
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
    await database.insert(legalCases).values({
      id: "case-1",
      organizationId: "org-1",
      clientId: "client-1",
      identification: "Caso de prueba",
      status: "in_progress",
    });
    await database.delete(caseActivities);
  }, 30_000);

  afterEach(async () => pg.close());

  test("orders events and keeps immutable activity after deletion", async () => {
    const activityIds = [
      "activity-created-1",
      "activity-created-2",
      "activity-updated",
      "activity-deleted",
    ];
    const store = createDrizzleCaseEventStore(
      database as never,
      () => activityIds.shift() ?? "unexpected",
    );

    await expect(
      store.create(actor, "case-1", "event-later", {
        title: "Entrevista posterior",
        type: "interview",
        date: "2026-09-20",
        description: null,
      }),
    ).resolves.toMatchObject({ status: "created" });
    const createdFirst = await store.create(actor, "case-1", "event-first", {
      title: "Primer informe",
      type: "oral_argument",
      date: "2026-09-10",
      description: "Ante la Sala",
    });
    expect(createdFirst).toMatchObject({ status: "created" });
    if (createdFirst.status !== "created") throw new Error("event not created");

    await expect(
      store.list("org-1", "case-1", { page: 1, pageSize: 25 }),
    ).resolves.toMatchObject({
      events: [{ id: "event-first" }, { id: "event-later" }],
      total: 2,
    });

    const updated = await store.update(
      actor,
      "case-1",
      "event-first",
      {
        title: "Primer informe reprogramado",
        date: "2026-09-12",
      },
      createdFirst.event.updatedAt.toISOString(),
    );
    expect(updated).toMatchObject({
      status: "updated",
      event: {
        title: "Primer informe reprogramado",
        date: "2026-09-12",
      },
    });
    if (updated.status !== "updated") throw new Error("event not updated");
    await expect(
      store.update(
        actor,
        "case-1",
        "event-first",
        { title: "Primer informe reprogramado" },
        updated.event.updatedAt.toISOString(),
      ),
    ).resolves.toMatchObject({ status: "unchanged" });
    await expect(
      store.remove(
        actor,
        "case-1",
        "event-first",
        updated.event.updatedAt.toISOString(),
      ),
    ).resolves.toEqual({ status: "removed" });

    expect(
      await database.select({ id: caseEvents.id }).from(caseEvents),
    ).toEqual([{ id: "event-later" }]);
    expect(
      await database
        .select({ type: caseActivities.type, details: caseActivities.details })
        .from(caseActivities),
    ).toEqual(
      expect.arrayContaining([
        {
          type: "case.event_created",
          details: {
            eventId: "event-first",
            title: "Primer informe",
            type: "oral_argument",
            date: "2026-09-10",
            description: "Ante la Sala",
          },
        },
        {
          type: "case.event_updated",
          details: {
            eventId: "event-first",
            title: "Primer informe",
            type: "oral_argument",
            date: "2026-09-10",
            description: "Ante la Sala",
            newTitle: "Primer informe reprogramado",
            newType: "oral_argument",
            newDate: "2026-09-12",
            newDescription: "Ante la Sala",
          },
        },
        {
          type: "case.event_deleted",
          details: {
            eventId: "event-first",
            title: "Primer informe reprogramado",
            type: "oral_argument",
            date: "2026-09-12",
            description: "Ante la Sala",
          },
        },
      ]),
    );
    expect(activityIds).toEqual([]);
  }, 30_000);

  test("rejects stale event updates and deletions", async () => {
    const store = createDrizzleCaseEventStore(database as never);
    const created = await store.create(actor, "case-1", "event-1", {
      title: "Informe oral",
      type: "oral_argument",
      date: "2026-09-12",
      description: null,
    });
    if (created.status !== "created") throw new Error("event not created");

    await expect(
      store.update(
        actor,
        "case-1",
        "event-1",
        { title: "Cambio tardío" },
        "2020-01-01T00:00:00.000Z",
      ),
    ).resolves.toEqual({ status: "conflict" });
    await expect(
      store.remove(actor, "case-1", "event-1", "2020-01-01T00:00:00.000Z"),
    ).resolves.toEqual({ status: "conflict" });

    await expect(
      store.remove(
        actor,
        "case-1",
        "event-1",
        created.event.updatedAt.toISOString(),
      ),
    ).resolves.toEqual({ status: "removed" });
  }, 30_000);

  test("keeps archived cases readable and rejects their mutations", async () => {
    const store = createDrizzleCaseEventStore(database as never);
    await store.create(actor, "case-1", "event-1", {
      title: "Informe oral",
      type: "oral_argument",
      date: "2026-09-12",
      description: null,
    });
    await database
      .update(legalCases)
      .set({ archivedAt: new Date("2026-09-03T12:00:00Z") });

    await expect(
      store.list("org-1", "case-1", { page: 1, pageSize: 25 }),
    ).resolves.toMatchObject({ total: 1 });
    await expect(
      store.create(actor, "case-1", "event-2", {
        title: "Otro informe",
        type: "oral_argument",
        date: "2026-09-20",
        description: null,
      }),
    ).resolves.toEqual({ status: "case_archived" });
    await expect(
      store.update(
        actor,
        "case-1",
        "event-1",
        { title: "Cambio" },
        "2026-09-03T10:00:00.000Z",
      ),
    ).resolves.toEqual({ status: "case_archived" });
    await expect(
      store.remove(actor, "case-1", "event-1", "2026-09-03T10:00:00.000Z"),
    ).resolves.toEqual({
      status: "case_archived",
    });
  }, 30_000);

  test("does not reveal events across tenants or parent cases", async () => {
    const store = createDrizzleCaseEventStore(database as never);
    await store.create(actor, "case-1", "event-1", {
      title: "Informe oral",
      type: "oral_argument",
      date: "2026-09-12",
      description: null,
    });

    await expect(
      store.list("org-2", "case-1", { page: 1, pageSize: 25 }),
    ).resolves.toBeNull();
    await expect(
      store.update(
        actor,
        "case-missing",
        "event-1",
        { title: "Cambio" },
        "2026-09-03T10:00:00.000Z",
      ),
    ).resolves.toEqual({ status: "not_found" });
    await expect(
      store.remove(
        actor,
        "case-missing",
        "event-1",
        "2026-09-03T10:00:00.000Z",
      ),
    ).resolves.toEqual({ status: "not_found" });
  }, 30_000);

  test("lists the bounded calendar with portfolio filters and excludes archived cases", async () => {
    const now = new Date("2026-09-03T10:00:00Z");
    await database.insert(user).values({
      id: "user-2",
      name: "María Núñez",
      email: "maria@orbit.test",
      emailVerified: true,
      createdAt: now,
      updatedAt: now,
    });
    await database.insert(member).values({
      id: "member-2",
      organizationId: "org-1",
      userId: "user-2",
      role: "member",
      createdAt: now,
    });
    await database.insert(legalCases).values([
      {
        id: "case-2",
        organizationId: "org-1",
        clientId: "client-1",
        identification: "Revisión de devolución",
        type: "judicial",
        claimantType: "client",
        stage: "judicial_first_instance",
        docketNumber: "0002-2026",
        disputedMatter: "Crédito fiscal",
        status: "in_progress",
      },
      {
        id: "case-archived",
        organizationId: "org-1",
        clientId: "client-1",
        identification: "Caso archivado",
        type: "judicial",
        claimantType: "client",
        status: "in_progress",
        archivedAt: now,
      },
    ]);
    await database.insert(caseAssignments).values({
      id: "assignment-2",
      organizationId: "org-1",
      caseId: "case-2",
      userId: "user-2",
      userNameSnapshot: "María Núñez",
      userEmailSnapshot: "maria@orbit.test",
      responsibility: "member",
      assignedByUserId: "user-1",
      assignedByNameSnapshot: "Cristian",
    });
    await database.insert(caseEvents).values([
      {
        id: "event-calendar-2",
        organizationId: "org-1",
        caseId: "case-2",
        title: "Informe de apelación",
        type: "oral_argument",
        date: "2026-09-17",
      },
      {
        id: "event-calendar-1",
        organizationId: "org-1",
        caseId: "case-2",
        title: "Informe oral",
        type: "oral_argument",
        date: "2026-09-10",
      },
      {
        id: "event-archived",
        organizationId: "org-1",
        caseId: "case-archived",
        title: "Informe oculto",
        type: "oral_argument",
        date: "2026-09-12",
      },
    ]);
    const store = createDrizzleCaseEventStore(database as never);

    await expect(
      store.calendar("org-1", {
        from: "2026-09-01",
        to: "2026-09-30",
        caseStatus: "in_progress",
        search: "devolucion",
        types: ["judicial"],
        clientIds: ["client-1"],
        memberUserIds: ["user-2"],
        limit: 501,
      }),
    ).resolves.toMatchObject([
      {
        id: "event-calendar-1",
        case: {
          id: "case-2",
          identification: "Revisión de devolución",
          docketNumber: "0002-2026",
          client: { id: "client-1", name: "Cliente" },
        },
      },
      { id: "event-calendar-2" },
    ]);
  }, 30_000);
});
