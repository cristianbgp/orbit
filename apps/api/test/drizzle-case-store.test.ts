import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import type { PGlite } from "@electric-sql/pglite";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { afterEach, beforeEach, describe, expect, test } from "vitest";

import * as schema from "../src/db/schema";
import {
  caseActions,
  caseActivities,
  caseAssignments,
  caseUpdates,
  client,
  legalCases,
  member,
  organization,
  user,
} from "../src/db/schema";
import { createDrizzleCaseStore } from "../src/cases/drizzle-case-store";
import type { CaseValues } from "../src/cases/case-service";
import { createTestPGlite } from "./support/create-test-pglite";

const actor = { userId: "user-1", organizationId: "org-1" };
const values: CaseValues = {
  clientId: "client-1",
  identification: "IR 2000 - DCA BBVA",
  type: "judicial",
  subtype: "dca",
  stage: "judicial_first_instance",
  entity: "judiciary",
  docketNumber: "08549-2021-0-1801-JR-CA-20",
  tax: "IR",
  periodKind: "year",
  periodStart: "2000-01-01",
  periodEnd: "2000-12-01",
  amount: "15500000.00",
  currency: "PEN",
  claimantType: "client",
  disputedMatter: "Gastos comunes no deducibles",
  challengedResolution: "07532-9-2021",
  status: "in_progress",
  result: null,
};

describe("Drizzle case store", () => {
  let clientDatabase: PGlite;
  let database: ReturnType<typeof drizzle<typeof schema>>;

  beforeEach(async () => {
    clientDatabase = createTestPGlite();
    database = drizzle(clientDatabase, { schema });
    const folder = fileURLToPath(new URL("../drizzle", import.meta.url));
    for (const migration of (await readdir(folder))
      .filter((name) => /^\d{4}_.+\.sql$/.test(name))
      .sort()) {
      await clientDatabase.exec(
        await readFile(`${folder}/${migration}`, "utf8"),
      );
    }
    const now = new Date("2026-09-02T10:00:00Z");
    await database
      .insert(organization)
      .values({ id: "org-1", name: "Orbit", slug: "orbit", createdAt: now });
    await database.insert(user).values([
      {
        id: "user-1",
        name: "Cristian Granda",
        email: "cristian@orbit.test",
        emailVerified: true,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: "user-2",
        name: "Ana Prado",
        email: "ana@orbit.test",
        emailVerified: true,
        createdAt: now,
        updatedAt: now,
      },
    ]);
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
        position: "senior",
        createdAt: now,
      },
    ]);
    await database.insert(client).values({
      id: "client-1",
      organizationId: "org-1",
      type: "company",
      name: "BBVA",
    });
  }, 30_000);

  afterEach(async () => clientDatabase.close());

  test("creates a case, initial assignment, and immutable activities atomically", async () => {
    const ids = ["activity-created", "assignment-1", "activity-assigned"];
    const store = createDrizzleCaseStore(
      database as never,
      () => ids.shift() ?? "unexpected",
    );

    await expect(
      store.create(actor, "case-1", values, {
        members: ["user-2"],
        followers: [],
      }),
    ).resolves.toMatchObject({
      status: "created",
      case: { id: "case-1", client: { name: "BBVA" }, team: { total: 1 } },
    });
    await expect(database.select().from(legalCases)).resolves.toHaveLength(1);
    await expect(database.select().from(caseAssignments)).resolves.toEqual([
      expect.objectContaining({
        id: "assignment-1",
        userNameSnapshot: "Ana Prado",
        responsibility: "member",
      }),
    ]);
    await expect(database.select().from(caseActivities)).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "case.created",
          actorNameSnapshot: "Cristian Granda",
        }),
        expect.objectContaining({
          type: "case_assignment.added",
          subjectNameSnapshot: "Ana Prado",
        }),
      ]),
    );
  }, 30_000);

  test("rolls back creation when an initial user is not an organization member", async () => {
    const store = createDrizzleCaseStore(database as never);
    await expect(
      store.create(actor, "case-1", values, {
        members: ["missing-user"],
        followers: [],
      }),
    ).resolves.toEqual({ status: "member_not_found" });
    await expect(database.select().from(legalCases)).resolves.toEqual([]);
    await expect(database.select().from(caseActivities)).resolves.toEqual([]);
  }, 30_000);

  test("records readable client snapshots and returns linkable activity identities", async () => {
    await database.insert(client).values({
      id: "client-2",
      organizationId: "org-1",
      type: "company",
      name: "Cliente nuevo",
    });
    const ids = ["activity-created", "assignment-1", "activity-assigned"];
    const store = createDrizzleCaseStore(
      database as never,
      () => ids.shift() ?? "activity-updated",
    );
    await store.create(actor, "case-1", values, {
      members: ["user-2"],
      followers: [],
    });

    await expect(
      store.update(actor, "case-1", { clientId: "client-2" }),
    ).resolves.toMatchObject({ status: "updated" });
    const rows = await database
      .select()
      .from(caseActivities)
      .where(eq(caseActivities.type, "case.updated"));
    expect(rows[0]?.details).toMatchObject({
      previousClientName: "BBVA",
      newClientName: "Cliente nuevo",
    });

    const activity = await store.listActivities("org-1", "case-1", {
      page: 1,
      pageSize: 10,
    });
    expect(activity?.activities).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "case_assignment.added",
          subject: expect.objectContaining({
            userId: "user-2",
            alias: "AP",
            nameSnapshot: "Ana Prado",
            activeStudioMember: true,
            linkable: true,
          }),
        }),
      ]),
    );
  }, 30_000);

  test("records complete period and money snapshots when one grouped value changes", async () => {
    const store = createDrizzleCaseStore(database as never);
    await store.create(actor, "case-1", values, { members: [], followers: [] });
    await store.update(actor, "case-1", {
      periodStart: "2001-01-01",
      periodEnd: "2001-12-01",
      amount: "16000000.00",
    });

    const rows = await database
      .select()
      .from(caseActivities)
      .where(eq(caseActivities.type, "case.updated"));
    expect(rows[0]?.details).toMatchObject({
      previousPeriodKind: "year",
      newPeriodKind: "year",
      previousPeriodStart: "2000-01-01",
      newPeriodStart: "2001-01-01",
      previousPeriodEnd: "2000-12-01",
      newPeriodEnd: "2001-12-01",
      previousAmount: "15500000.00",
      newAmount: "16000000.00",
      previousCurrency: "PEN",
      newCurrency: "PEN",
    });
  }, 30_000);

  test("records readable claimant snapshots when its fixed option changes", async () => {
    const store = createDrizzleCaseStore(database as never);
    await store.create(actor, "case-1", values, { members: [], followers: [] });

    await store.update(actor, "case-1", { claimantType: "sunat" });

    const rows = await database
      .select()
      .from(caseActivities)
      .where(eq(caseActivities.type, "case.updated"));
    expect(rows[0]?.details).toMatchObject({
      previousClaimantType: "client",
      newClaimantType: "sunat",
      previousClientName: "BBVA",
      newClientName: "BBVA",
    });
  }, 30_000);

  test("adds non-archived action and development counts to grouped cases", async () => {
    const store = createDrizzleCaseStore(database as never);
    await store.create(actor, "case-1", values, { members: [], followers: [] });
    const createdAt = new Date("2026-09-03T12:00:00.000Z");
    await database.insert(caseActions).values([
      {
        id: "action-active",
        organizationId: "org-1",
        caseId: "case-1",
        description: "Revisar resolución",
        status: "pending",
        createdByUserId: "user-1",
        createdAt,
        updatedAt: createdAt,
      },
      {
        id: "action-completed",
        organizationId: "org-1",
        caseId: "case-1",
        description: "Preparar escrito",
        status: "completed",
        createdByUserId: "user-1",
        createdAt,
        updatedAt: createdAt,
      },
      {
        id: "action-archived",
        organizationId: "org-1",
        caseId: "case-1",
        description: "Acción archivada",
        status: "pending",
        createdByUserId: "user-1",
        createdAt,
        updatedAt: createdAt,
        archivedAt: createdAt,
      },
    ]);
    await database.insert(caseUpdates).values([
      {
        id: "update-active",
        organizationId: "org-1",
        caseId: "case-1",
        date: "2026-09-03",
        description: "Sentencia notificada",
        createdByUserId: "user-1",
        createdAt,
        updatedAt: createdAt,
      },
      {
        id: "update-background",
        organizationId: "org-1",
        caseId: "case-1",
        date: "2026-09-01",
        description: "Antecedente",
        kind: "background",
        createdByUserId: "user-1",
        createdAt,
        updatedAt: createdAt,
      },
      {
        id: "update-archived",
        organizationId: "org-1",
        caseId: "case-1",
        date: "2026-09-02",
        description: "Novedad archivada",
        createdByUserId: "user-1",
        createdAt,
        updatedAt: createdAt,
        archivedAt: createdAt,
      },
    ]);
    const result = await store.listGroupedByClient("org-1", {
      page: 1,
      pageSize: 10,
    });
    expect(result.groups[0]?.cases[0]).toMatchObject({
      activeActionCount: 2,
      activeUpdateCount: 1,
    });
  }, 30_000);
});
