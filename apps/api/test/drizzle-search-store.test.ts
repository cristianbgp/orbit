import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import type { PGlite } from "@electric-sql/pglite";
import { createTestPGlite } from "./support/create-test-pglite";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { afterEach, beforeEach, describe, expect, test } from "vitest";

import * as schema from "../src/db/schema";
import {
  client,
  legalCases,
  member,
  organization,
  project,
  projectStage,
  projectTask,
  user,
} from "../src/db/schema";
import { createDrizzleSearchStore } from "../src/search/drizzle-search-store";

describe("Drizzle global search store", () => {
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
        name: "Orbit",
        slug: "orbit",
        timeZone: "America/Lima",
        createdAt: timestamp,
      },
      {
        id: "org-2",
        name: "Ajeno",
        slug: "ajeno",
        timeZone: "America/Lima",
        createdAt: timestamp,
      },
    ]);
    await db.insert(user).values([
      {
        id: "user-1",
        name: "Ana Visible",
        email: "ana@orbit.test",
        emailVerified: true,
        alias: null,
        createdAt: timestamp,
        updatedAt: timestamp,
      },
      {
        id: "user-2",
        name: "Persona Ajena",
        email: "persona@ajeno.test",
        emailVerified: true,
        alias: "PA",
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
    await db.insert(client).values([
      {
        id: "client-visible",
        organizationId: "org-1",
        type: "company",
        name: "Visible Cliente",
        documentNumber: "VISIBLE-201",
      },
      {
        id: "client-other",
        organizationId: "org-2",
        type: "company",
        name: "Visible Ajeno",
      },
      {
        id: "client-ranking",
        organizationId: "org-1",
        type: "company",
        name: "Ranking Cliente",
      },
    ]);

    const currentProject = {
      organizationId: "org-1",
      clientId: "client-visible",
      type: "consultation" as const,
      status: "completed" as const,
      startDate: "2026-08-01",
      endDate: "2026-08-31",
    };
    await db.insert(project).values([
      {
        ...currentProject,
        id: "project-visible",
        name: "Visible Expediente",
        internalReference: "VISIBLE-REF",
      },
      {
        ...currentProject,
        id: "project-archived",
        name: "Visible Archivado",
        archivedAt: timestamp,
      },
      {
        ...currentProject,
        id: "project-other",
        organizationId: "org-2",
        clientId: "client-other",
        name: "Visible Extranjero",
      },
      {
        ...currentProject,
        id: "project-exact",
        clientId: "client-ranking",
        name: "Caso",
      },
      {
        ...currentProject,
        id: "project-prefix",
        clientId: "client-ranking",
        name: "Caso Norte",
      },
      {
        ...currentProject,
        id: "project-contains",
        clientId: "client-ranking",
        name: "Mi caso sur",
      },
      {
        ...currentProject,
        id: "project-literal",
        clientId: "client-ranking",
        name: "Caso %_ especial",
      },
    ]);
    await db.insert(projectStage).values([
      {
        id: "stage-visible",
        organizationId: "org-1",
        projectId: "project-visible",
        name: "Visible Análisis",
        position: 0,
      },
      {
        id: "stage-archived",
        organizationId: "org-1",
        projectId: "project-archived",
        name: "Visible Archivo",
        position: 0,
      },
      {
        id: "stage-other",
        organizationId: "org-2",
        projectId: "project-other",
        name: "Visible Ajeno",
        position: 0,
      },
    ]);
    const task = {
      organizationId: "org-1",
      projectId: "project-visible",
      stageId: "stage-visible",
      status: "completed" as const,
      position: 0,
      createdByNameSnapshot: "Ana Visible",
    };
    await db.insert(projectTask).values([
      { ...task, id: "task-visible", title: "Visible Tarea" },
      {
        ...task,
        id: "task-archived",
        title: "Visible Tarea Archivada",
        archivedAt: timestamp,
        position: 1,
      },
      {
        ...task,
        id: "task-project-archived",
        projectId: "project-archived",
        stageId: "stage-archived",
        title: "Visible Proyecto Archivado",
      },
      {
        ...task,
        id: "task-other",
        organizationId: "org-2",
        projectId: "project-other",
        stageId: "stage-other",
        title: "Visible Extranjera",
      },
    ]);
    await db.insert(legalCases).values([
      {
        id: "case-visible",
        organizationId: "org-1",
        clientId: "client-visible",
        identification: "Visible Proceso",
        type: "administrative",
        stage: "administrative_appeal",
        docketNumber: "EXP-VISIBLE",
        status: "in_progress",
      },
      {
        id: "case-archived",
        organizationId: "org-1",
        clientId: "client-visible",
        identification: "Visible Caso Archivado",
        status: "in_progress",
        archivedAt: timestamp,
      },
      {
        id: "case-other",
        organizationId: "org-2",
        clientId: "client-other",
        identification: "Visible Caso Ajeno",
        status: "in_progress",
      },
    ]);
  });

  afterEach(async () => pg.close());

  test("returns eligible records only from the current organization", async () => {
    const store = createDrizzleSearchStore(db as never);

    expect(await store.hasMembership("user-1", "org-1")).toBe(true);
    expect(await store.hasMembership("user-2", "org-1")).toBe(false);

    const result = await store.search(
      { userId: "user-1", organizationId: "org-1" },
      "visible",
      10,
    );

    expect(result.projects.map(({ id }) => id)).toEqual(["project-visible"]);
    expect(result.projects[0]).toMatchObject({ status: "completed" });
    expect(result.cases.map(({ id }) => id)).toEqual(["case-visible"]);
    expect(result.cases[0]).toMatchObject({
      status: "in_progress",
      client: { id: "client-visible", name: "Visible Cliente" },
    });
    expect(result.tasks.map(({ id }) => id)).toEqual(["task-visible"]);
    expect(result.tasks[0]).toMatchObject({ status: "completed" });
    expect(result.clients.map(({ id }) => id)).toEqual(["client-visible"]);
    expect(result.members.map(({ userId }) => userId)).toEqual(["user-1"]);
    expect(result.members[0]).toMatchObject({ alias: "AV" });
  });

  test("searches task context and the generated member alias", async () => {
    const store = createDrizzleSearchStore(db as never);

    const byStage = await store.search(
      { userId: "user-1", organizationId: "org-1" },
      "analisis",
      5,
    );
    const byAlias = await store.search(
      { userId: "user-1", organizationId: "org-1" },
      "AV",
      5,
    );

    expect(byStage.tasks.map(({ id }) => id)).toEqual(["task-visible"]);
    expect(byAlias.members.map(({ userId }) => userId)).toEqual(["user-1"]);
  });

  test("rejects inconsistent cross-organization client and stage relations", async () => {
    const store = createDrizzleSearchStore(db as never);

    await db
      .update(project)
      .set({ clientId: "client-other" })
      .where(eq(project.id, "project-visible"));
    let result = await store.search(
      { userId: "user-1", organizationId: "org-1" },
      "ajeno",
      10,
    );
    expect(result.projects).toEqual([]);
    expect(result.tasks).toEqual([]);

    await db
      .update(project)
      .set({ clientId: "client-visible" })
      .where(eq(project.id, "project-visible"));
    await db
      .update(projectTask)
      .set({ stageId: "stage-other" })
      .where(eq(projectTask.id, "task-visible"));
    result = await store.search(
      { userId: "user-1", organizationId: "org-1" },
      "ajeno",
      10,
    );
    expect(result.tasks).toEqual([]);
  });

  test("ranks exact, prefix, and contains matches deterministically", async () => {
    const result = await createDrizzleSearchStore(db as never).search(
      { userId: "user-1", organizationId: "org-1" },
      "caso",
      10,
    );

    expect(result.projects.map(({ id }) => id)).toEqual([
      "project-exact",
      "project-literal",
      "project-prefix",
      "project-contains",
    ]);
  });

  test("treats percent and underscore as literal search characters", async () => {
    const result = await createDrizzleSearchStore(db as never).search(
      { userId: "user-1", organizationId: "org-1" },
      "%_",
      10,
    );

    expect(result.projects.map(({ id }) => id)).toEqual(["project-literal"]);
    expect(result.cases).toEqual([]);
    expect(result.tasks).toEqual([]);
    expect(result.clients).toEqual([]);
    expect(result.members).toEqual([]);
  });
});
