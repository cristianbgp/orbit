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
  projectStage,
  user,
} from "../src/db/schema";
import { createDrizzleProjectStageStore } from "../src/project-stages/drizzle-project-stage-store";

const actor = { userId: "user-1", organizationId: "org-1" };

describe("Drizzle project stage store", () => {
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
      id: actor.userId,
      name: "Ana Torres",
      email: "ana@orbit.test",
      emailVerified: true,
      alias: "AT",
      createdAt: now,
      updatedAt: now,
    });
    await database.insert(organization).values({
      id: actor.organizationId,
      name: "Orbit",
      slug: "orbit",
      createdAt: now,
    });
    await database.insert(member).values({
      id: "member-1",
      organizationId: actor.organizationId,
      userId: actor.userId,
      role: "member",
      createdAt: now,
    });
    await database.insert(client).values({
      id: "client-1",
      organizationId: actor.organizationId,
      type: "company",
      name: "Cliente",
    });
    await database.insert(project).values({
      id: "project-1",
      organizationId: actor.organizationId,
      clientId: "client-1",
      name: "Proyecto",
      type: "consultation",
      status: "active",
      startDate: "2026-08-12",
      endDate: "2026-08-20",
    });
    await database.insert(projectStage).values([
      {
        id: "stage-1",
        organizationId: actor.organizationId,
        projectId: "project-1",
        name: "Investigación",
        description: "Revisar antecedentes",
        position: 0,
      },
      {
        id: "stage-2",
        organizationId: actor.organizationId,
        projectId: "project-1",
        name: "Redacción",
        description: null,
        position: 1,
      },
    ]);
  }, 30_000);

  afterEach(async () => pg.close());

  test("records stage lifecycle and order changes atomically without no-op noise", async () => {
    const ids = ["created", "updated", "reordered", "deleted"];
    const store = createDrizzleProjectStageStore(
      database as never,
      () => `activity-${ids.shift() ?? "unexpected"}`,
    );

    await store.create(actor, "project-1", {
      id: "stage-3",
      name: "Audiencia",
      description: null,
    });
    await store.update(actor, "project-1", "stage-1", {
      name: "Análisis",
      description: null,
    });
    await store.reorder(actor, "project-1", ["stage-3", "stage-2", "stage-1"]);
    await store.remove(actor, "project-1", "stage-2");

    const beforeNoOps = await database.select().from(projectActivity);
    await store.update(actor, "project-1", "stage-1", {
      name: "Análisis",
      description: null,
    });
    await store.reorder(actor, "project-1", ["stage-3", "stage-1"]);

    expect(await database.select().from(projectActivity)).toHaveLength(
      beforeNoOps.length,
    );
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
          type: "project.stage_created",
          details: {
            stageId: "stage-3",
            stageName: "Audiencia",
            stageDescription: null,
            stagePosition: "2",
          },
        },
        {
          type: "project.stage_details_changed",
          details: {
            stageId: "stage-1",
            stageName: "Análisis",
            previousName: "Investigación",
            newName: "Análisis",
            previousDescription: "Revisar antecedentes",
            newDescription: null,
          },
        },
        expect.objectContaining({
          type: "project.stages_reordered",
          details: {
            previousOrder: JSON.stringify([
              { id: "stage-1", name: "Análisis" },
              { id: "stage-2", name: "Redacción" },
              { id: "stage-3", name: "Audiencia" },
            ]),
            newOrder: JSON.stringify([
              { id: "stage-3", name: "Audiencia" },
              { id: "stage-2", name: "Redacción" },
              { id: "stage-1", name: "Análisis" },
            ]),
          },
        }),
        {
          type: "project.stage_deleted",
          details: {
            stageId: "stage-2",
            stageName: "Redacción",
            stageDescription: null,
            stagePosition: "1",
          },
        },
      ]),
    );
  }, 30_000);

  test.each(["create", "update", "reorder", "remove"] as const)(
    "rejects %s before changing an archived project",
    async (operation) => {
      await database.update(project).set({ archivedAt: new Date() });
      const store = createDrizzleProjectStageStore(database as never);

      const result =
        operation === "create"
          ? await store.create(actor, "project-1", {
              id: "stage-new",
              name: "Audiencia",
              description: null,
            })
          : operation === "update"
            ? await store.update(actor, "project-1", "stage-1", {
                name: "Audiencia",
              })
            : operation === "reorder"
              ? await store.reorder(actor, "project-1", ["stage-1", "stage-2"])
              : await store.remove(actor, "project-1", "stage-1");

      expect(result).toEqual(
        operation === "remove"
          ? "project_archived"
          : { status: "project_archived" },
      );
      expect(await database.select().from(projectActivity)).toEqual([]);
    },
    30_000,
  );
});
