import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import type { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { afterEach, beforeEach, describe, expect, test } from "vitest";

import { createDrizzleCasePresentationStore } from "../src/case-presentation/drizzle-case-presentation-store";
import type { CasePresentationFilters } from "../src/case-presentation/case-presentation-types";
import * as schema from "../src/db/schema";
import {
  caseActions,
  caseAssignments,
  caseEvents,
  caseUpdates,
  client,
  legalCases,
  member,
  organization,
  user,
} from "../src/db/schema";
import { createTestPGlite } from "./support/create-test-pglite";

const defaults: CasePresentationFilters = {
  statuses: ["in_progress"],
  clientIds: [],
  types: [],
  memberUserIds: [],
  includeCompletedActions: false,
  includePastEvents: false,
};

describe("Drizzle Case Presentation store", () => {
  let pg: PGlite;
  let database: ReturnType<typeof drizzle<typeof schema>>;

  beforeEach(async () => {
    pg = createTestPGlite();
    database = drizzle(pg, { schema });
    const folder = fileURLToPath(new URL("../drizzle", import.meta.url));
    for (const migration of (await readdir(folder))
      .filter((name) => /^\d{4}_.+\.sql$/.test(name))
      .sort()) {
      await pg.exec(await readFile(`${folder}/${migration}`, "utf8"));
    }

    const now = new Date("2026-09-04T12:00:00.000Z");
    await database.insert(user).values([
      {
        id: "user-1",
        name: "Ana Socia",
        email: "ana@orbit.test",
        emailVerified: true,
        alias: "AS",
        createdAt: now,
        updatedAt: now,
      },
      {
        id: "user-2",
        name: "Bruno Junior",
        email: "bruno@orbit.test",
        emailVerified: true,
        alias: "BJ",
        createdAt: now,
        updatedAt: now,
      },
    ]);
    await database.insert(organization).values({
      id: "org-1",
      name: "Orbit",
      slug: "orbit",
      timeZone: "America/Lima",
      createdAt: now,
    });
    await database.insert(member).values([
      {
        id: "member-1",
        organizationId: "org-1",
        userId: "user-1",
        role: "owner",
        position: "partner",
        createdAt: now,
      },
      {
        id: "member-2",
        organizationId: "org-1",
        userId: "user-2",
        role: "member",
        position: "junior",
        createdAt: now,
      },
    ]);
    await database.insert(client).values([
      {
        id: "client-z",
        organizationId: "org-1",
        type: "company",
        name: "Zeta",
      },
      {
        id: "client-a",
        organizationId: "org-1",
        type: "company",
        name: "Andes",
      },
    ]);
    await database.insert(legalCases).values([
      {
        id: "case-b",
        organizationId: "org-1",
        clientId: "client-z",
        identification: "Caso B",
        type: "judicial",
        stage: "judicial_first_instance",
        status: "in_progress",
        claimantType: "client",
      },
      {
        id: "case-a",
        organizationId: "org-1",
        clientId: "client-a",
        identification: "Caso A",
        type: "administrative",
        status: "in_progress",
        periodKind: "year",
        periodStart: "2026-01-01",
        periodEnd: "2026-12-01",
      },
    ]);
    await database.insert(caseAssignments).values([
      {
        id: "assignment-a",
        organizationId: "org-1",
        caseId: "case-a",
        userId: "user-1",
        userNameSnapshot: "Ana Socia",
        userEmailSnapshot: "ana@orbit.test",
        assignedByUserId: "user-1",
        assignedByNameSnapshot: "Ana Socia",
        assignedAt: now,
      },
      {
        id: "assignment-b",
        organizationId: "org-1",
        caseId: "case-b",
        userId: "user-2",
        userNameSnapshot: "Bruno Junior",
        userEmailSnapshot: "bruno@orbit.test",
        assignedByUserId: "user-1",
        assignedByNameSnapshot: "Ana Socia",
        assignedAt: now,
      },
    ]);
    await database.insert(caseUpdates).values([
      {
        id: "update-current",
        organizationId: "org-1",
        caseId: "case-a",
        date: "2026-09-03",
        description: "Novedad visible",
        kind: "update",
        createdByUserId: "user-1",
        createdAt: now,
        updatedAt: now,
      },
      {
        id: "update-background",
        organizationId: "org-1",
        caseId: "case-a",
        date: "2026-09-02",
        description: "Antecedente oculto",
        kind: "background",
        createdByUserId: "user-1",
        createdAt: now,
        updatedAt: now,
      },
      {
        id: "update-background-2",
        organizationId: "org-1",
        caseId: "case-a",
        date: "2026-09-01",
        description: "Segundo antecedente",
        kind: "background",
        createdByUserId: "user-1",
        createdAt: now,
        updatedAt: now,
      },
      {
        id: "update-background-3",
        organizationId: "org-1",
        caseId: "case-a",
        date: "2026-08-31",
        description: "Tercer antecedente",
        kind: "background",
        createdByUserId: "user-1",
        createdAt: now,
        updatedAt: now,
      },
      {
        id: "update-background-4",
        organizationId: "org-1",
        caseId: "case-a",
        date: "2026-08-30",
        description: "Cuarto antecedente",
        kind: "background",
        createdByUserId: "user-1",
        createdAt: now,
        updatedAt: now,
      },
    ]);
    await database.insert(caseActions).values([
      {
        id: "action-pending",
        organizationId: "org-1",
        caseId: "case-a",
        description: "Preparar respuesta",
        status: "pending",
        assigneeUserId: "user-1",
        assigneeNameSnapshot: "Ana Socia",
        createdByUserId: "user-1",
        createdAt: now,
        updatedAt: now,
      },
      {
        id: "action-completed",
        organizationId: "org-1",
        caseId: "case-a",
        description: "Acción terminada",
        status: "completed",
        assigneeUserId: "user-1",
        assigneeNameSnapshot: "Ana Socia",
        createdByUserId: "user-1",
        completedAt: now,
        createdAt: new Date("2026-09-03T12:00:00.000Z"),
        updatedAt: now,
      },
    ]);
    await database.insert(caseEvents).values([
      {
        id: "event-past",
        organizationId: "org-1",
        caseId: "case-a",
        title: "Informe anterior",
        type: "oral_argument",
        date: "2026-09-03",
        createdByUserId: "user-1",
        createdAt: now,
        updatedAt: now,
      },
      {
        id: "event-future",
        organizationId: "org-1",
        caseId: "case-a",
        title: "Informe próximo",
        type: "oral_argument",
        date: "2026-09-05",
        createdByUserId: "user-1",
        createdAt: now,
        updatedAt: now,
      },
    ]);
  }, 30_000);

  afterEach(async () => pg.close());

  test("builds the active weekly portfolio with operational children", async () => {
    const store = createDrizzleCasePresentationStore(database as never, {
      now: () => new Date("2026-09-04T12:00:00.000Z"),
    });

    const result = await store.list("org-1", { ...defaults });

    expect(result.organizationDate).toBe("2026-09-04");
    expect(result.clients.map((entry) => entry.name)).toEqual([
      "Andes",
      "Zeta",
    ]);
    expect(result.clients[0]?.cases[0]).toMatchObject({
      id: "case-a",
      periodKind: "year",
      periodStart: "2026-01-01",
      periodEnd: "2026-12-01",
      team: [{ userId: "user-1", alias: "AS", position: "partner" }],
      followers: [],
      updates: [{ id: "update-current" }],
      backgrounds: [
        { id: "update-background" },
        { id: "update-background-2" },
        { id: "update-background-3" },
        { id: "update-background-4" },
      ],
      actions: [{ id: "action-pending" }],
      events: [{ id: "event-future" }],
    });
    expect(result.truncated).toEqual({ value: false, scopes: [] });
  });

  test("supports member filters and optional completed actions and past events", async () => {
    const store = createDrizzleCasePresentationStore(database as never, {
      now: () => new Date("2026-09-04T12:00:00.000Z"),
    });

    const result = await store.list("org-1", {
      ...defaults,
      memberUserIds: ["user-1"],
      includeCompletedActions: true,
      includePastEvents: true,
    });

    expect(result.clients).toHaveLength(1);
    expect(result.clients[0]?.cases[0]).toMatchObject({ id: "case-a" });
    expect(
      result.clients[0]?.cases[0]?.actions.map((entry) => entry.id),
    ).toEqual(["action-pending", "action-completed"]);
    expect(
      result.clients[0]?.cases[0]?.events.map((entry) => entry.id),
    ).toEqual(["event-future", "event-past"]);
  });
});
