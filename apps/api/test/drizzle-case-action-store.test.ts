import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import type { PGlite } from "@electric-sql/pglite";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { afterEach, beforeEach, describe, expect, test } from "vitest";

import { createDrizzleCaseActionStore } from "../src/case-actions/drizzle-case-action-store";
import * as schema from "../src/db/schema";
import {
  caseActions,
  caseActivities,
  caseAssignments,
  client,
  legalCases,
  member,
  organization,
  user,
} from "../src/db/schema";
import { createTestPGlite } from "./support/create-test-pglite";

const folder = fileURLToPath(new URL("../drizzle", import.meta.url));
const actor = { userId: "user-1", organizationId: "org-1" };

describe("Drizzle case action store", () => {
  let pg: PGlite;
  let db: ReturnType<typeof drizzle<typeof schema>>;

  beforeEach(async () => {
    pg = createTestPGlite();
    db = drizzle(pg, { schema });
    for (const migration of (await readdir(folder))
      .filter((name) => /^\d{4}_.+\.sql$/.test(name))
      .sort())
      await pg.exec(await readFile(`${folder}/${migration}`, "utf8"));
    const now = new Date("2026-09-03T12:00:00.000Z");
    await db.insert(user).values([
      {
        id: "user-1",
        name: "Cristian Granda",
        email: "cristian@orbit.test",
        emailVerified: true,
        alias: "CG",
        createdAt: now,
        updatedAt: now,
      },
      {
        id: "user-2",
        name: "Ana Torres",
        email: "ana@orbit.test",
        emailVerified: true,
        alias: "AT",
        createdAt: now,
        updatedAt: now,
      },
      {
        id: "user-3",
        name: "Fuera del caso",
        email: "outside@orbit.test",
        emailVerified: true,
        createdAt: now,
        updatedAt: now,
      },
    ]);
    await db
      .insert(organization)
      .values({ id: "org-1", name: "Orbit", slug: "orbit", createdAt: now });
    await db.insert(member).values([
      {
        id: "member-1",
        organizationId: "org-1",
        userId: "user-1",
        role: "member",
        createdAt: now,
      },
      {
        id: "member-2",
        organizationId: "org-1",
        userId: "user-2",
        role: "member",
        createdAt: now,
      },
      {
        id: "member-3",
        organizationId: "org-1",
        userId: "user-3",
        role: "member",
        createdAt: now,
      },
    ]);
    await db.insert(client).values({
      id: "client-1",
      organizationId: "org-1",
      type: "company",
      name: "Cliente",
    });
    await db.insert(legalCases).values({
      id: "case-1",
      organizationId: "org-1",
      clientId: "client-1",
      identification: "Caso principal",
      createdByUserId: "user-1",
    });
    await db.insert(caseAssignments).values({
      id: "assignment-1",
      organizationId: "org-1",
      caseId: "case-1",
      userId: "user-2",
      userNameSnapshot: "Ana Torres",
      userEmailSnapshot: "ana@orbit.test",
      responsibility: "member",
      assignedByUserId: "user-1",
      assignedByNameSnapshot: "Cristian Granda",
    });
  }, 30_000);

  afterEach(async () => pg.close());

  test("runs assignment, completion, reopening and archive lifecycle with immutable activity", async () => {
    const ids = Array.from(
      { length: 10 },
      (_, index) => `activity-${index + 1}`,
    );
    const store = createDrizzleCaseActionStore(db as never, () => ids.shift()!);
    const created = await store.create(actor, "case-1", "action-1", {
      description: "Revisar sentencia",
      assigneeUserId: null,
    });
    expect(created).toMatchObject({
      status: "created",
      action: { assignee: null, status: "pending" },
    });
    if (created.status !== "created") throw new Error("Expected creation");

    const assigned = await store.update(
      actor,
      "case-1",
      "action-1",
      { assigneeUserId: "user-2" },
      created.action.updatedAt.toISOString(),
    );
    expect(assigned).toMatchObject({
      status: "updated",
      action: { assignee: { alias: "AT", activeCaseMember: true } },
    });
    if (!("action" in assigned)) throw new Error("Expected assignment");

    const completed = await store.complete(
      actor,
      "case-1",
      "action-1",
      assigned.action.updatedAt.toISOString(),
    );
    expect(completed).toMatchObject({
      status: "updated",
      action: { status: "completed", completedAt: expect.any(Date) },
    });
    if (!("action" in completed)) throw new Error("Expected completion");

    const reopened = await store.reopen(
      actor,
      "case-1",
      "action-1",
      completed.action.updatedAt.toISOString(),
    );
    expect(reopened).toMatchObject({
      status: "updated",
      action: { status: "pending", completedAt: null },
    });
    if (!("action" in reopened)) throw new Error("Expected reopening");

    const archived = await store.archive(
      actor,
      "case-1",
      "action-1",
      reopened.action.updatedAt.toISOString(),
    );
    expect(archived).toMatchObject({
      status: "updated",
      action: { archivedAt: expect.any(Date) },
    });
    if (!("action" in archived)) throw new Error("Expected archive");
    const restored = await store.restore(
      actor,
      "case-1",
      "action-1",
      archived.action.updatedAt.toISOString(),
    );
    expect(restored).toMatchObject({
      status: "updated",
      action: { archivedAt: null, status: "pending" },
    });

    const activities = await db
      .select({ type: caseActivities.type })
      .from(caseActivities);
    expect(activities.map(({ type }) => type)).toEqual([
      "case.action_created",
      "case.action_assigned",
      "case.action_completed",
      "case.action_reopened",
      "case.action_archived",
      "case.action_restored",
    ]);
  }, 30_000);

  test("rejects assignees outside the active case team and preserves removed member snapshots", async () => {
    const store = createDrizzleCaseActionStore(db as never);
    await db.insert(caseAssignments).values({
      id: "follower-1",
      organizationId: "org-1",
      caseId: "case-1",
      userId: "user-3",
      userNameSnapshot: "Fuera del caso",
      userEmailSnapshot: "outside@orbit.test",
      responsibility: "follower",
      assignedByUserId: "user-1",
      assignedByNameSnapshot: "Cristian Granda",
    });
    await expect(
      store.create(actor, "case-1", "outside", {
        description: "No permitida",
        assigneeUserId: "user-3",
      }),
    ).resolves.toEqual({ status: "assignee_not_found" });
    const created = await store.create(actor, "case-1", "action-1", {
      description: "Acción",
      assigneeUserId: "user-2",
    });
    if (created.status !== "created") throw new Error("Expected creation");
    await db
      .update(caseAssignments)
      .set({ endedAt: new Date() })
      .where(eq(caseAssignments.id, "assignment-1"));
    const result = await store.list("org-1", "case-1", {
      status: "pending",
      page: 1,
      pageSize: 10,
    });
    expect(result?.actions[0]?.assignee).toMatchObject({
      fullName: "Ana Torres",
      activeCaseMember: false,
    });
  }, 30_000);

  test("lists lifecycle scopes and keeps archived parents read-only", async () => {
    const store = createDrizzleCaseActionStore(db as never);
    const created = await store.create(actor, "case-1", "action-1", {
      description: "Acción",
      assigneeUserId: null,
    });
    if (created.status !== "created") throw new Error("Expected creation");
    await store.complete(
      actor,
      "case-1",
      "action-1",
      created.action.updatedAt.toISOString(),
    );
    expect(
      (
        await store.list("org-1", "case-1", {
          status: "completed",
          page: 1,
          pageSize: 10,
        })
      )?.total,
    ).toBe(1);
    await db
      .update(legalCases)
      .set({ archivedAt: new Date() })
      .where(eq(legalCases.id, "case-1"));
    await expect(
      store.create(actor, "case-1", "blocked", {
        description: "No permitida",
        assigneeUserId: null,
      }),
    ).resolves.toEqual({ status: "case_archived" });
    expect(await db.select().from(caseActions)).toHaveLength(1);
  }, 30_000);

  test("lists pending and completed active actions by creation time", async () => {
    const store = createDrizzleCaseActionStore(db as never);
    await db.insert(caseActions).values([
      {
        id: "old-pending",
        organizationId: "org-1",
        caseId: "case-1",
        description: "Pendiente anterior",
        status: "pending",
        createdByUserId: "user-1",
        createdAt: new Date("2026-09-01T12:00:00.000Z"),
        updatedAt: new Date("2026-09-01T12:00:00.000Z"),
      },
      {
        id: "new-completed",
        organizationId: "org-1",
        caseId: "case-1",
        description: "Completada reciente",
        status: "completed",
        completedAt: new Date("2026-09-03T12:00:00.000Z"),
        createdByUserId: "user-1",
        createdAt: new Date("2026-09-02T12:00:00.000Z"),
        updatedAt: new Date("2026-09-03T12:00:00.000Z"),
      },
      {
        id: "archived",
        organizationId: "org-1",
        caseId: "case-1",
        description: "Archivada",
        status: "pending",
        createdByUserId: "user-1",
        createdAt: new Date("2026-09-03T12:00:00.000Z"),
        updatedAt: new Date("2026-09-03T12:00:00.000Z"),
        archivedAt: new Date("2026-09-03T13:00:00.000Z"),
      },
    ]);
    const result = await store.list("org-1", "case-1", {
      status: "active",
      page: 1,
      pageSize: 10,
    });
    expect(result?.actions.map(({ id }) => id)).toEqual([
      "new-completed",
      "old-pending",
    ]);
    expect(result?.total).toBe(2);
  }, 30_000);
});
