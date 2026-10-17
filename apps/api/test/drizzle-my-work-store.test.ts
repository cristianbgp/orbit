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
  projectAssignment,
  projectStage,
  projectTask,
  taskAssignment,
  user,
  legalCases,
  caseAssignments,
  caseActions,
} from "../src/db/schema";
import { createDrizzleMyWorkStore } from "../src/my-work/drizzle-my-work-store";

describe("Drizzle my work store", () => {
  let pg: PGlite;
  let db: ReturnType<typeof drizzle<typeof schema>>;
  const timestamp = new Date("2026-08-10T10:00:00.000Z");

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
        name: "Otro",
        slug: "otro",
        timeZone: "America/Lima",
        createdAt: timestamp,
      },
    ]);
    await db.insert(user).values([
      {
        id: "user-1",
        name: "Ana Torres",
        email: "ana@orbit.test",
        emailVerified: true,
        alias: "AT",
        createdAt: timestamp,
        updatedAt: timestamp,
      },
      {
        id: "user-2",
        name: "Luis Paz",
        email: "luis@orbit.test",
        emailVerified: true,
        alias: "LP",
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
        position: "junior",
        createdAt: timestamp,
      },
      {
        id: "member-2",
        organizationId: "org-1",
        userId: "user-2",
        role: "member",
        position: "senior",
        createdAt: timestamp,
      },
    ]);
    await db.insert(client).values([
      {
        id: "client-1",
        organizationId: "org-1",
        type: "company",
        name: "Cliente Uno",
      },
      {
        id: "client-2",
        organizationId: "org-2",
        type: "company",
        name: "Cliente Dos",
      },
    ]);
    const baseProject = {
      organizationId: "org-1",
      clientId: "client-1",
      type: "consultation" as const,
      status: "active" as const,
      startDate: "2026-08-01",
      endDate: "2026-08-15",
    };
    await db.insert(project).values([
      {
        ...baseProject,
        id: "project-1",
        name: "Consulta principal",
        internalReference: "REF-CASE-77",
      },
      {
        ...baseProject,
        id: "project-archived",
        name: "Archivado",
        archivedAt: timestamp,
      },
      {
        ...baseProject,
        id: "project-2",
        organizationId: "org-2",
        clientId: "client-2",
        name: "Ajeno",
      },
    ]);
    await db.insert(projectStage).values([
      {
        id: "stage-1",
        organizationId: "org-1",
        projectId: "project-1",
        name: "Redacción",
        position: 0,
      },
      {
        id: "stage-a",
        organizationId: "org-1",
        projectId: "project-archived",
        name: "Archivo",
        position: 0,
      },
      {
        id: "stage-2",
        organizationId: "org-2",
        projectId: "project-2",
        name: "Ajeno",
        position: 0,
      },
    ]);
    const taskBase = {
      organizationId: "org-1",
      projectId: "project-1",
      stageId: "stage-1",
      status: "pending" as const,
      position: 0,
      createdByNameSnapshot: "Ana Torres",
    };
    await db.insert(projectTask).values([
      {
        ...taskBase,
        id: "task-overdue",
        title: "Vencida",
        plannedStartDate: "2026-08-01",
        internalDueDate: "2026-08-09",
      },
      {
        ...taskBase,
        id: "task-blocked",
        title: "Suspendida",
        status: "blocked",
        internalDueDate: "2026-08-20",
        position: 1,
      },
      {
        ...taskBase,
        id: "task-unassigned",
        title: "Sin responsable",
        internalDueDate: null,
        position: 2,
      },
      {
        ...taskBase,
        id: "task-completed",
        title: "Completada",
        status: "completed",
        internalDueDate: "2026-08-10",
        position: 3,
      },
      {
        ...taskBase,
        id: "task-archived-project",
        projectId: "project-archived",
        stageId: "stage-a",
        title: "No visible",
        position: 0,
      },
      {
        ...taskBase,
        id: "task-other-org",
        organizationId: "org-2",
        projectId: "project-2",
        stageId: "stage-2",
        title: "Ajena",
        position: 0,
      },
    ]);
    await db.insert(taskAssignment).values([
      {
        id: "ta-1",
        organizationId: "org-1",
        projectId: "project-1",
        taskId: "task-overdue",
        userId: "user-1",
        userNameSnapshot: "Ana Torres",
        userEmailSnapshot: "ana@orbit.test",
        assignedByNameSnapshot: "Luis Paz",
      },
      {
        id: "ta-2",
        organizationId: "org-1",
        projectId: "project-1",
        taskId: "task-overdue",
        userId: "user-2",
        userNameSnapshot: "Luis Paz",
        userEmailSnapshot: "luis@orbit.test",
        assignedByNameSnapshot: "Ana Torres",
      },
      {
        id: "ta-3",
        organizationId: "org-1",
        projectId: "project-1",
        taskId: "task-blocked",
        userId: "user-1",
        userNameSnapshot: "Ana Torres",
        userEmailSnapshot: "ana@orbit.test",
        assignedByNameSnapshot: "Luis Paz",
        endedAt: timestamp,
        endReason: "task_unassigned",
      },
      {
        id: "ta-4",
        organizationId: "org-1",
        projectId: "project-1",
        taskId: "task-completed",
        userId: "user-1",
        userNameSnapshot: "Ana Torres",
        userEmailSnapshot: "ana@orbit.test",
        assignedByNameSnapshot: "Luis Paz",
      },
    ]);
    await db.insert(projectAssignment).values({
      id: "pa-1",
      organizationId: "org-1",
      projectId: "project-1",
      userId: "user-1",
      userNameSnapshot: "Ana Torres",
      userEmailSnapshot: "ana@orbit.test",
      responsibility: "responsible",
      assignedByNameSnapshot: "Luis Paz",
    });
  });

  afterEach(async () => pg.close());

  const filters = {
    page: 1,
    pageSize: 25,
    search: undefined,
    projectIds: [],
    statuses: [],
    dateFrom: undefined,
    dateTo: undefined,
    includeCompleted: false,
    today: "2026-08-10",
    weekEnd: "2026-08-16",
  };

  test("lists only active assignments in the current organization and hydrates all responsibles", async () => {
    const result = await createDrizzleMyWorkStore(
      db as never,
    ).listAssignedTasks("org-1", "user-1", filters);
    expect(result.tasks.map((task) => task.id)).toEqual(["task-overdue"]);
    expect(result.tasks[0]).toMatchObject({
      group: "overdue",
      responsibles: [
        { userAlias: "AT", userPosition: "junior" },
        { userAlias: "LP", userPosition: "senior" },
      ],
    });
  });

  test("includes completed assigned tasks only when requested", async () => {
    const store = createDrizzleMyWorkStore(db as never);
    const without = await store.listAssignedTasks("org-1", "user-1", filters);
    const withCompleted = await store.listAssignedTasks("org-1", "user-1", {
      ...filters,
      includeCompleted: true,
    });
    expect(without.tasks.map(({ id }) => id)).not.toContain("task-completed");
    expect(
      withCompleted.tasks.map(({ id, group }) => [id, group]),
    ).toContainEqual(["task-completed", "completed"]);
  });

  test("finds assigned tasks by their project internal reference", async () => {
    const result = await createDrizzleMyWorkStore(
      db as never,
    ).listAssignedTasks("org-1", "user-1", {
      ...filters,
      search: "REF-CASE-77",
    });

    expect(result.tasks.map(({ id }) => id)).toEqual(["task-overdue"]);
  });

  test("groups assigned tasks by how their planned interval intersects today and the current week", async () => {
    await db.insert(projectTask).values([
      {
        organizationId: "org-1",
        projectId: "project-1",
        stageId: "stage-1",
        id: "task-active-today",
        title: "Activa hoy",
        status: "pending",
        position: 9,
        plannedStartDate: "2026-08-06",
        internalDueDate: "2026-08-20",
        createdByNameSnapshot: "Ana Torres",
      },
      {
        organizationId: "org-1",
        projectId: "project-1",
        stageId: "stage-1",
        id: "task-this-week",
        title: "Esta semana",
        status: "pending",
        position: 10,
        plannedStartDate: "2026-08-11",
        internalDueDate: "2026-08-20",
        createdByNameSnapshot: "Ana Torres",
      },
      {
        organizationId: "org-1",
        projectId: "project-1",
        stageId: "stage-1",
        id: "task-future",
        title: "A futuro",
        status: "pending",
        position: 11,
        plannedStartDate: "2026-08-17",
        internalDueDate: "2026-08-20",
        createdByNameSnapshot: "Ana Torres",
      },
      {
        organizationId: "org-1",
        projectId: "project-1",
        stageId: "stage-1",
        id: "task-incomplete-range",
        title: "Sin rango completo",
        status: "pending",
        position: 12,
        plannedStartDate: "2026-08-08",
        createdByNameSnapshot: "Ana Torres",
      },
    ]);
    await db.insert(taskAssignment).values([
      {
        id: "ta-active-today",
        organizationId: "org-1",
        projectId: "project-1",
        taskId: "task-active-today",
        userId: "user-1",
        userNameSnapshot: "Ana Torres",
        userEmailSnapshot: "ana@orbit.test",
        assignedByNameSnapshot: "Luis Paz",
      },
      {
        id: "ta-this-week",
        organizationId: "org-1",
        projectId: "project-1",
        taskId: "task-this-week",
        userId: "user-1",
        userNameSnapshot: "Ana Torres",
        userEmailSnapshot: "ana@orbit.test",
        assignedByNameSnapshot: "Luis Paz",
      },
      {
        id: "ta-future",
        organizationId: "org-1",
        projectId: "project-1",
        taskId: "task-future",
        userId: "user-1",
        userNameSnapshot: "Ana Torres",
        userEmailSnapshot: "ana@orbit.test",
        assignedByNameSnapshot: "Luis Paz",
      },
      {
        id: "ta-incomplete-range",
        organizationId: "org-1",
        projectId: "project-1",
        taskId: "task-incomplete-range",
        userId: "user-1",
        userNameSnapshot: "Ana Torres",
        userEmailSnapshot: "ana@orbit.test",
        assignedByNameSnapshot: "Luis Paz",
      },
    ]);

    const result = await createDrizzleMyWorkStore(
      db as never,
    ).listAssignedTasks("org-1", "user-1", {
      ...filters,
      weekEnd: "2026-08-16",
    } as never);

    expect(result.tasks.map(({ id, group }) => [id, group])).toEqual([
      ["task-overdue", "overdue"],
      ["task-active-today", "today"],
      ["task-this-week", "this_week"],
      ["task-future", "future"],
      ["task-incomplete-range", "undated"],
    ]);
  });

  test("returns stable non-archived status counts while keeping the attention preview filtered", async () => {
    await db.insert(projectTask).values({
      organizationId: "org-1",
      projectId: "project-1",
      stageId: "stage-1",
      id: "task-archived",
      title: "Archivada",
      status: "in_progress",
      position: 12,
      archivedAt: timestamp,
      createdByNameSnapshot: "Ana Torres",
    });
    const store = createDrizzleMyWorkStore(db as never);
    const result = await store.listSupervisedProjects("org-1", "user-1", {
      ...filters,
      statuses: ["blocked"],
      dateFrom: "2026-08-19",
      includeCompleted: false,
      previewLimit: 5,
    });
    expect(result.projects).toHaveLength(1);
    expect(result.projects[0]).toMatchObject({
      id: "project-1",
      counts: {
        pending: 2,
        inProgress: 0,
        blocked: 1,
        completed: 1,
        unassigned: 2,
        total: 4,
      },
    });
    expect(result.projects[0]!.attentionTasks.map(({ id }) => id)).toEqual([
      "task-blocked",
    ]);
  });

  test("finds supervised projects by internal reference or task title", async () => {
    const store = createDrizzleMyWorkStore(db as never);

    const byReference = await store.listSupervisedProjects("org-1", "user-1", {
      ...filters,
      search: "REF-CASE-77",
      previewLimit: 5,
    });
    expect(byReference.projects.map(({ id }) => id)).toEqual(["project-1"]);
    expect(byReference.projects[0]?.attentionTasks.map(({ id }) => id)).toEqual(
      ["task-blocked", "task-unassigned"],
    );

    const byTask = await store.listSupervisedProjects("org-1", "user-1", {
      ...filters,
      search: "Suspendida",
      previewLimit: 5,
    });
    expect(byTask.projects.map(({ id }) => id)).toEqual(["project-1"]);
    expect(byTask.projects[0]?.attentionTasks.map(({ id }) => id)).toEqual([
      "task-blocked",
    ]);
  });

  test("lists only active case actions assigned to the current case member", async () => {
    await db.insert(legalCases).values({
      id: "case-1",
      organizationId: "org-1",
      clientId: "client-1",
      identification: "Proceso de apelación",
      type: "judicial",
      claimantType: "client",
      status: "in_progress",
    });
    await db.insert(caseAssignments).values({
      id: "case-assignment-1",
      organizationId: "org-1",
      caseId: "case-1",
      userId: "user-1",
      userNameSnapshot: "Ana Torres",
      userEmailSnapshot: "ana@orbit.test",
      assignedByNameSnapshot: "Luis Paz",
    });
    await db.insert(caseActions).values([
      {
        id: "case-action-pending",
        organizationId: "org-1",
        caseId: "case-1",
        description: "Preparar alegatos",
        assigneeUserId: "user-1",
        assigneeNameSnapshot: "Ana Torres",
        createdByUserId: "user-2",
        status: "pending",
        createdAt: timestamp,
        updatedAt: timestamp,
      },
      {
        id: "case-action-completed",
        organizationId: "org-1",
        caseId: "case-1",
        description: "Revisar expediente",
        assigneeUserId: "user-1",
        assigneeNameSnapshot: "Ana Torres",
        createdByUserId: "user-2",
        status: "completed",
        completedAt: timestamp,
        completedByUserId: "user-1",
        createdAt: timestamp,
        updatedAt: timestamp,
      },
    ]);
    const store = createDrizzleMyWorkStore(db as never);
    const pending = await store.listAssignedCaseActions("org-1", "user-1", {
      page: 1,
      pageSize: 25,
      search: "alegatos",
      clientIds: [],
      caseIds: [],
      types: ["judicial"],
      includeCompleted: false,
    });
    expect(pending.actions.map(({ id }) => id)).toEqual([
      "case-action-pending",
    ]);
    const all = await store.listAssignedCaseActions("org-1", "user-1", {
      page: 1,
      pageSize: 25,
      clientIds: [],
      caseIds: [],
      types: [],
      includeCompleted: true,
    });
    expect(all.actions).toHaveLength(2);
    expect(all.actions[0]?.case).toMatchObject({
      identification: "Proceso de apelación",
      client: { name: "Cliente Uno" },
    });
  });
});
