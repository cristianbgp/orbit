import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import type { PGlite } from "@electric-sql/pglite";
import { createTestPGlite } from "./support/create-test-pglite";
import { asc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { afterEach, beforeEach, describe, expect, test } from "vitest";

import * as schema from "../src/db/schema";
import {
  client,
  member,
  organization,
  project,
  projectActivity,
  projectAssignment,
  projectEvent,
  projectStage,
  projectTask,
  user,
} from "../src/db/schema";
import { createDrizzleProjectStore } from "../src/projects/drizzle-project-store";
import type { ProjectValues } from "../src/projects/project-types";

const actor = { userId: "user-1", organizationId: "org-1" };
const values: ProjectValues = {
  clientId: "client-1",
  name: "Recurso de apelación",
  type: "written_submission",
  status: "draft",
  startDate: "2026-08-06",
  endDate: "2026-08-14",
  internalReference: null,
  description: null,
};
const storedValues = values;

describe("Drizzle project store", () => {
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
    await database.insert(organization).values({
      id: "org-1",
      name: "Orbit Estudio",
      slug: "orbit-estudio",
      createdAt: timestamp,
    });
    await database.insert(user).values({
      id: "user-1",
      name: "Cristian Granda",
      email: "cristian@orbit.test",
      emailVerified: true,
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
    await database.insert(client).values({
      id: "client-1",
      organizationId: "org-1",
      type: "company",
      name: "Construcciones del Sur S.A.",
    });
  }, 30_000);

  afterEach(async () => {
    await clientDatabase.close();
  });

  test("creates a project and its single actor-snapshot activity atomically", async () => {
    const store = createDrizzleProjectStore(
      database as never,
      () => "activity-created",
    );

    await expect(
      store.create(
        actor,
        "project-1",
        values,
        [
          {
            id: "stage-1",
            name: "Investigación",
            description: "Reunir antecedentes.",
            position: 0,
          },
        ],
        [],
        [],
      ),
    ).resolves.toMatchObject({
      status: "created",
      project: { id: "project-1", archivedAt: null },
    });

    await expect(database.select().from(projectActivity)).resolves.toEqual([
      expect.objectContaining({
        id: "activity-created",
        projectId: "project-1",
        type: "project.created",
        actorUserId: "user-1",
        actorNameSnapshot: "Cristian Granda",
        details: { projectName: "Recurso de apelación" },
      }),
    ]);
    const storedProject = await clientDatabase.query<{
      endDate: string;
    }>(`
      SELECT "end_date"::text AS "endDate"
      FROM "project"
      WHERE "id" = 'project-1'
    `);
    expect(storedProject.rows).toEqual([{ endDate: "2026-08-14" }]);
    await expect(database.select().from(projectEvent)).resolves.toEqual([]);
  }, 30_000);

  test("creates initial team assignments and their activities in the project transaction", async () => {
    const timestamp = new Date("2026-08-10T10:00:00.000Z");
    await database.insert(user).values({
      id: "user-2",
      name: "Luis Ramos",
      email: "luis@orbit.test",
      emailVerified: true,
      createdAt: timestamp,
      updatedAt: timestamp,
    });
    await database.insert(member).values({
      id: "member-2",
      organizationId: "org-1",
      userId: "user-2",
      role: "member",
      createdAt: timestamp,
    });
    const generatedIds = [
      "assignment-1",
      "activity-created",
      "activity-assigned",
    ];
    const store = createDrizzleProjectStore(
      database as never,
      () => generatedIds.shift() ?? "unexpected-id",
    );

    await expect(
      store.create(
        actor,
        "project-1",
        values,
        [],
        [],
        [{ userId: "user-2", responsibility: "responsible" }],
      ),
    ).resolves.toMatchObject({ status: "created" });

    await expect(database.select().from(projectAssignment)).resolves.toEqual([
      expect.objectContaining({
        id: "assignment-1",
        projectId: "project-1",
        userId: "user-2",
        userNameSnapshot: "Luis Ramos",
        userEmailSnapshot: "luis@orbit.test",
        responsibility: "responsible",
        assignedByUserId: "user-1",
      }),
    ]);
    await expect(
      database
        .select({
          type: projectActivity.type,
          subjectUserId: projectActivity.subjectUserId,
          subjectNameSnapshot: projectActivity.subjectNameSnapshot,
          details: projectActivity.details,
        })
        .from(projectActivity)
        .orderBy(asc(projectActivity.id)),
    ).resolves.toEqual([
      {
        type: "project_assignment.added",
        subjectUserId: "user-2",
        subjectNameSnapshot: "Luis Ramos",
        details: {
          assignmentId: "assignment-1",
          responsibility: "responsible",
        },
      },
      {
        type: "project.created",
        subjectUserId: null,
        subjectNameSnapshot: null,
        details: { projectName: "Recurso de apelación" },
      },
    ]);
  }, 30_000);

  test("rolls back project creation when an initial member is unavailable", async () => {
    const store = createDrizzleProjectStore(database as never);

    await expect(
      store.create(
        actor,
        "project-1",
        values,
        [],
        [],
        [{ userId: "missing-user", responsibility: "member" }],
      ),
    ).resolves.toEqual({ status: "member_not_found" });

    await expect(database.select().from(project)).resolves.toEqual([]);
    await expect(database.select().from(projectAssignment)).resolves.toEqual(
      [],
    );
    await expect(database.select().from(projectActivity)).resolves.toEqual([]);
  }, 30_000);

  test("creates immutable activity snapshots for multiple initial legal events", async () => {
    const generatedIds = [
      "event-1",
      "event-2",
      "activity-created",
      "activity-event-1",
      "activity-event-2",
    ];
    const store = createDrizzleProjectStore(
      database as never,
      () => generatedIds.shift() ?? "unexpected-id",
    );

    await expect(
      store.create(
        actor,
        "project-1",
        values,
        [],
        [
          {
            title: "Audiencia inicial",
            date: "2026-08-18",
            description: "Vista de la causa",
          },
          {
            title: "Presentación de escrito",
            date: "2026-08-20",
            description: null,
          },
        ],
        [],
      ),
    ).resolves.toMatchObject({ status: "created" });

    await expect(
      database
        .select({
          title: projectEvent.title,
          date: projectEvent.date,
          description: projectEvent.description,
        })
        .from(projectEvent),
    ).resolves.toEqual([
      {
        title: "Audiencia inicial",
        date: "2026-08-18",
        description: "Vista de la causa",
      },
      {
        title: "Presentación de escrito",
        date: "2026-08-20",
        description: null,
      },
    ]);
    await expect(
      database
        .select({
          type: projectActivity.type,
          details: projectActivity.details,
        })
        .from(projectActivity)
        .orderBy(asc(projectActivity.id)),
    ).resolves.toEqual([
      {
        type: "project.created",
        details: { projectName: "Recurso de apelación" },
      },
      {
        type: "project.event_created",
        details: {
          eventId: "event-1",
          title: "Audiencia inicial",
          type: "legal",
          date: "2026-08-18",
          description: "Vista de la causa",
        },
      },
      {
        type: "project.event_created",
        details: {
          eventId: "event-2",
          title: "Presentación de escrito",
          type: "legal",
          date: "2026-08-20",
          description: null,
        },
      },
    ]);
  }, 30_000);

  test("filters current and archived projects independently from status", async () => {
    await database.insert(project).values([
      { id: "current", organizationId: "org-1", ...storedValues },
      {
        id: "archived",
        organizationId: "org-1",
        ...storedValues,
        status: "completed",
        archivedAt: new Date("2026-08-10T11:00:00.000Z"),
      },
    ]);
    const store = createDrizzleProjectStore(database as never);

    await expect(
      store.list("org-1", {
        view: "current",
        page: 1,
        pageSize: 25,
      }),
    ).resolves.toMatchObject({ projects: [{ id: "current" }], total: 1 });
    await expect(
      store.list("org-1", {
        view: "archived",
        statuses: ["completed"],
        page: 1,
        pageSize: 25,
      }),
    ).resolves.toMatchObject({ projects: [{ id: "archived" }], total: 1 });
  }, 30_000);

  test("finds projects by internal reference or a non-archived task title", async () => {
    await database.insert(project).values({
      id: "project-search",
      organizationId: "org-1",
      ...storedValues,
      name: "Asunto reservado",
      internalReference: "EXP-2026-088",
    });
    await database.insert(projectStage).values({
      id: "stage-search",
      organizationId: "org-1",
      projectId: "project-search",
      name: "Preparación",
      position: 0,
    });
    await database.insert(projectTask).values([
      {
        id: "task-search",
        organizationId: "org-1",
        projectId: "project-search",
        stageId: "stage-search",
        title: "Preparar contestación arbitral",
        status: "pending",
        position: 0,
        createdByNameSnapshot: "Cristian Granda",
      },
      {
        id: "task-search-archived",
        organizationId: "org-1",
        projectId: "project-search",
        stageId: "stage-search",
        title: "Texto archivado exclusivo",
        status: "pending",
        position: 1,
        archivedAt: new Date("2026-08-10T11:00:00.000Z"),
        createdByNameSnapshot: "Cristian Granda",
      },
    ]);
    const store = createDrizzleProjectStore(database as never);

    await expect(
      store.list("org-1", {
        search: "EXP-2026-088",
        view: "current",
        page: 1,
        pageSize: 25,
      }),
    ).resolves.toMatchObject({
      projects: [{ id: "project-search" }],
      total: 1,
    });
    await expect(
      store.list("org-1", {
        search: "contestacion arbitral",
        view: "current",
        page: 1,
        pageSize: 25,
      }),
    ).resolves.toMatchObject({
      projects: [{ id: "project-search" }],
      total: 1,
    });
    await expect(
      store.list("org-1", {
        search: "archivado exclusivo",
        view: "current",
        page: 1,
        pageSize: 25,
      }),
    ).resolves.toMatchObject({ projects: [], total: 0 });
  }, 30_000);

  test("filters projects by multiple properties and requires every active team member", async () => {
    const timestamp = new Date("2026-08-10T10:00:00.000Z");
    await database.insert(user).values({
      id: "user-2",
      name: "María Pérez",
      email: "maria@orbit.test",
      emailVerified: true,
      createdAt: timestamp,
      updatedAt: timestamp,
    });
    await database.insert(member).values({
      id: "member-2",
      organizationId: "org-1",
      userId: "user-2",
      role: "member",
      createdAt: timestamp,
    });
    await database.insert(project).values([
      {
        id: "project-both",
        organizationId: "org-1",
        ...storedValues,
        status: "active",
      },
      {
        id: "project-one",
        organizationId: "org-1",
        ...storedValues,
        type: "consultation",
      },
    ]);
    await database.insert(projectAssignment).values([
      ...["user-1", "user-2"].map((userId, index) => ({
        id: `assignment-both-${index}`,
        organizationId: "org-1",
        projectId: "project-both",
        userId,
        userNameSnapshot: userId,
        userEmailSnapshot: `${userId}@orbit.test`,
        responsibility: "member" as const,
        assignedByUserId: "user-1",
        assignedByNameSnapshot: "Cristian Granda",
        assignedAt: timestamp,
      })),
      {
        id: "assignment-one-1",
        organizationId: "org-1",
        projectId: "project-one",
        userId: "user-1",
        userNameSnapshot: "Cristian Granda",
        userEmailSnapshot: "cristian@orbit.test",
        responsibility: "member" as const,
        assignedByUserId: "user-1",
        assignedByNameSnapshot: "Cristian Granda",
        assignedAt: timestamp,
      },
      {
        id: "assignment-one-ended",
        organizationId: "org-1",
        projectId: "project-one",
        userId: "user-2",
        userNameSnapshot: "María Pérez",
        userEmailSnapshot: "maria@orbit.test",
        responsibility: "member" as const,
        assignedByUserId: "user-1",
        assignedByNameSnapshot: "Cristian Granda",
        assignedAt: timestamp,
        endedAt: new Date("2026-08-11T10:00:00.000Z"),
        endedByUserId: "user-1",
        endedByNameSnapshot: "Cristian Granda",
        endReason: "project_unassigned" as const,
      },
    ]);
    const store = createDrizzleProjectStore(database as never);

    const result = await store.list("org-1", {
      types: ["written_submission", "consultation"],
      statuses: ["draft", "active"],
      clientIds: ["client-1"],
      memberUserIds: ["user-1", "user-2"],
      view: "current",
      page: 1,
      pageSize: 25,
    });

    expect(result.projects.map(({ id }) => id)).toEqual(["project-both"]);
    expect(result.total).toBe(1);
  }, 30_000);

  test("paginates clients while returning every matching project in each group", async () => {
    await database.insert(client).values([
      {
        id: "client-2",
        organizationId: "org-1",
        type: "company",
        name: "Alfa Legal S.A.",
      },
      {
        id: "client-3",
        organizationId: "org-1",
        type: "company",
        name: "Zeta Industrial S.A.",
      },
    ]);
    await database.insert(project).values([
      {
        id: "alfa-late",
        organizationId: "org-1",
        ...storedValues,
        clientId: "client-2",
        name: "Segundo asunto",
        status: "active",
        endDate: "2026-09-20",
      },
      {
        id: "alfa-early",
        organizationId: "org-1",
        ...storedValues,
        clientId: "client-2",
        name: "Primer asunto",
        status: "active",
        endDate: "2026-09-10",
      },
      {
        id: "construction",
        organizationId: "org-1",
        ...storedValues,
        status: "active",
      },
      {
        id: "zeta-draft",
        organizationId: "org-1",
        ...storedValues,
        clientId: "client-3",
        status: "draft",
      },
    ]);
    const store = createDrizzleProjectStore(database as never);

    await expect(
      store.listGroupedByClient("org-1", {
        statuses: ["active"],
        view: "current",
        page: 1,
        pageSize: 1,
      }),
    ).resolves.toMatchObject({
      groups: [
        {
          client: { id: "client-2", name: "Alfa Legal S.A." },
          projects: [{ id: "alfa-early" }, { id: "alfa-late" }],
        },
      ],
      clientTotal: 2,
      projectTotal: 3,
    });
  }, 30_000);

  test("orders list projects by the requested field and direction", async () => {
    await database.insert(project).values([
      {
        id: "project-zeta",
        organizationId: "org-1",
        ...storedValues,
        name: "Zeta",
        startDate: "2026-08-09",
        endDate: "2026-08-20",
      },
      {
        id: "project-alfa",
        organizationId: "org-1",
        ...storedValues,
        name: "Alfa",
        startDate: "2026-08-01",
        endDate: "2026-08-10",
      },
    ]);
    const store = createDrizzleProjectStore(database as never);

    const result = await store.list("org-1", {
      view: "current",
      orderBy: "name",
      order: "desc",
      page: 1,
      pageSize: 25,
    });

    expect(result.projects.map(({ id }) => id)).toEqual([
      "project-zeta",
      "project-alfa",
    ]);
  }, 30_000);

  test("filters lifecycle views before counting and pagination", async () => {
    await database.insert(project).values([
      {
        id: "project-draft",
        organizationId: "org-1",
        ...storedValues,
        name: "Borrador",
        status: "draft",
      },
      {
        id: "project-active",
        organizationId: "org-1",
        ...storedValues,
        name: "Activo",
        status: "active",
      },
      {
        id: "project-completed",
        organizationId: "org-1",
        ...storedValues,
        name: "Completado",
        status: "completed",
      },
      {
        id: "project-archived",
        organizationId: "org-1",
        ...storedValues,
        name: "Archivado",
        status: "completed",
        archivedAt: new Date("2026-08-12T10:00:00.000Z"),
      },
    ]);
    const store = createDrizzleProjectStore(database as never);

    const [compatible, current, completed, archived] = await Promise.all([
      store.list("org-1", { page: 1, pageSize: 25 }),
      store.list("org-1", {
        view: "current",
        page: 1,
        pageSize: 25,
      }),
      store.list("org-1", {
        view: "completed",
        page: 1,
        pageSize: 25,
      }),
      store.list("org-1", {
        view: "archived",
        page: 1,
        pageSize: 25,
      }),
    ]);

    expect(compatible.projects.map(({ id }) => id).sort()).toEqual([
      "project-active",
      "project-completed",
      "project-draft",
    ]);
    expect(compatible.total).toBe(3);
    expect(current.projects.map(({ id }) => id).sort()).toEqual([
      "project-active",
      "project-draft",
    ]);
    expect(current.total).toBe(2);
    expect(completed.projects.map(({ id }) => id)).toEqual([
      "project-completed",
    ]);
    expect(completed.total).toBe(1);
    expect(archived.projects.map(({ id }) => id)).toEqual(["project-archived"]);
    expect(archived.total).toBe(1);
  }, 30_000);

  test("hydrates the complete active project team with current positions", async () => {
    const timestamp = new Date("2026-08-10T10:00:00.000Z");
    await database.insert(project).values({
      id: "project-team",
      organizationId: "org-1",
      ...storedValues,
    });
    await database.insert(user).values([
      {
        id: "user-2",
        name: "Ana Mendoza",
        email: "ana@orbit.test",
        emailVerified: true,
        alias: "AM",
        avatarColor: "#4657d9",
        createdAt: timestamp,
        updatedAt: timestamp,
      },
      {
        id: "user-3",
        name: "Diego Salas",
        email: "diego@orbit.test",
        emailVerified: true,
        alias: "DS",
        avatarColor: "#0f766e",
        createdAt: timestamp,
        updatedAt: timestamp,
      },
      {
        id: "user-4",
        name: "Elena Torres",
        email: "elena@orbit.test",
        emailVerified: true,
        alias: "ET",
        avatarColor: "#4657d9",
        createdAt: timestamp,
        updatedAt: timestamp,
      },
      {
        id: "user-5",
        name: "Fabio Ruiz",
        email: "fabio@orbit.test",
        emailVerified: true,
        alias: "FR",
        avatarColor: "#0f766e",
        createdAt: timestamp,
        updatedAt: timestamp,
      },
      {
        id: "user-6",
        name: "Gina Paz",
        email: "gina@orbit.test",
        emailVerified: true,
        alias: "GP",
        avatarColor: "#4657d9",
        createdAt: timestamp,
        updatedAt: timestamp,
      },
      {
        id: "user-ended",
        name: "Usuario Retirado",
        email: "retirado@orbit.test",
        emailVerified: true,
        alias: "UR",
        avatarColor: "#4657d9",
        createdAt: timestamp,
        updatedAt: timestamp,
      },
    ]);
    await database.insert(member).values(
      ["2", "3", "4", "5", "6", "ended"].map((suffix, index) => ({
        id: `member-${suffix}`,
        organizationId: "org-1",
        userId: `user-${suffix}`,
        role: "member",
        position: ["partner", "senior", "junior", "assistant", "intern", null][
          index
        ],
        createdAt: timestamp,
      })),
    );
    await database.insert(projectAssignment).values([
      {
        id: "assignment-1",
        organizationId: "org-1",
        projectId: "project-team",
        userId: "user-1",
        userNameSnapshot: "Nombre anterior",
        userEmailSnapshot: "cristian@orbit.test",
        responsibility: "member",
        assignedByUserId: "user-1",
        assignedByNameSnapshot: "Cristian Granda",
        assignedAt: timestamp,
      },
      ...["2", "3", "4", "5", "6"].map((suffix, index) => ({
        id: `assignment-${suffix}`,
        organizationId: "org-1",
        projectId: "project-team",
        userId: `user-${suffix}`,
        userNameSnapshot: `Snapshot ${suffix}`,
        userEmailSnapshot: `user-${suffix}@orbit.test`,
        responsibility:
          index < 2 ? ("responsible" as const) : ("member" as const),
        assignedByUserId: "user-1",
        assignedByNameSnapshot: "Cristian Granda",
        assignedAt: timestamp,
      })),
      {
        id: "assignment-ended",
        organizationId: "org-1",
        projectId: "project-team",
        userId: "user-ended",
        userNameSnapshot: "Usuario Retirado",
        userEmailSnapshot: "retirado@orbit.test",
        responsibility: "responsible",
        assignedByUserId: "user-1",
        assignedByNameSnapshot: "Cristian Granda",
        assignedAt: timestamp,
        endedAt: new Date("2026-08-11T10:00:00.000Z"),
        endedByUserId: "user-1",
        endedByNameSnapshot: "Cristian Granda",
        endReason: "project_unassigned",
      },
    ]);
    const store = createDrizzleProjectStore(database as never);

    const result = await store.list("org-1", {
      view: "current",
      orderBy: "endDate",
      order: "asc",
      page: 1,
      pageSize: 25,
    });

    expect(result.projects[0]?.team).toEqual({
      members: [
        {
          userId: "user-2",
          fullName: "Ana Mendoza",
          alias: "AM",
          avatarColor: "#4657d9",
          responsibility: "responsible",
          position: "partner",
        },
        {
          userId: "user-3",
          fullName: "Diego Salas",
          alias: "DS",
          avatarColor: "#0f766e",
          responsibility: "responsible",
          position: "senior",
        },
        {
          userId: "user-1",
          fullName: "Cristian Granda",
          alias: "CG",
          avatarColor: "#4657d9",
          responsibility: "member",
          position: null,
        },
        {
          userId: "user-4",
          fullName: "Elena Torres",
          alias: "ET",
          avatarColor: "#4657d9",
          responsibility: "member",
          position: "junior",
        },
        expect.objectContaining({ userId: "user-5", position: "assistant" }),
        expect.objectContaining({ userId: "user-6", position: "intern" }),
      ],
      total: 6,
    });
  }, 30_000);

  test("groups meaningful update activity and suppresses semantic no-ops", async () => {
    await database.insert(project).values({
      id: "project-1",
      organizationId: "org-1",
      ...storedValues,
    });
    const activityIds = ["activity-1", "activity-2", "activity-3"];
    const store = createDrizzleProjectStore(
      database as never,
      () => activityIds.shift() ?? "unexpected-activity",
    );

    const update = await store.update(actor, "project-1", {
      name: "Demanda arbitral",
      endDate: "2026-08-18",
      status: "active",
    });
    expect(update).toMatchObject({
      status: "updated",
      project: {
        name: "Demanda arbitral",
        endDate: "2026-08-18",
        status: "active",
      },
    });

    await expect(
      database
        .select({ endDate: project.endDate })
        .from(project)
        .where(eq(project.id, "project-1")),
    ).resolves.toEqual([{ endDate: "2026-08-18" }]);
    const activities = await database
      .select({ type: projectActivity.type, details: projectActivity.details })
      .from(projectActivity)
      .orderBy(asc(projectActivity.id));
    expect(activities).toEqual([
      {
        type: "project.details_changed",
        details: {
          previousName: "Recurso de apelación",
          newName: "Demanda arbitral",
        },
      },
      {
        type: "project.dates_changed",
        details: {
          previousEndDate: "2026-08-14",
          newEndDate: "2026-08-18",
        },
      },
      {
        type: "project.status_changed",
        details: { previousStatus: "draft", newStatus: "active" },
      },
    ]);

    const updatedAt =
      update.status === "updated" ? update.project.updatedAt : null;
    await expect(
      store.update(actor, "project-1", {
        name: "Demanda arbitral",
        endDate: "2026-08-18",
        status: "active",
      }),
    ).resolves.toMatchObject({
      status: "unchanged",
      project: { updatedAt },
    });
    expect(await database.select().from(projectActivity)).toHaveLength(3);
  }, 30_000);

  test("archives and restores under one conflict-safe event per transition", async () => {
    await database.insert(project).values({
      id: "project-1",
      organizationId: "org-1",
      ...storedValues,
    });
    const activityIds = ["archive-event", "restore-event"];
    const store = createDrizzleProjectStore(
      database as never,
      () => activityIds.shift() ?? "unexpected-activity",
    );

    await expect(store.archive(actor, "project-1")).resolves.toMatchObject({
      status: "updated",
      project: { archivedAt: expect.any(Date) },
    });
    await expect(store.archive(actor, "project-1")).resolves.toEqual({
      status: "archive_conflict",
    });
    await expect(store.restore(actor, "project-1")).resolves.toMatchObject({
      status: "updated",
      project: { archivedAt: null },
    });
    await expect(store.restore(actor, "project-1")).resolves.toEqual({
      status: "archive_conflict",
    });

    await expect(
      database
        .select({ type: projectActivity.type })
        .from(projectActivity)
        .orderBy(asc(projectActivity.id)),
    ).resolves.toEqual([
      { type: "project.archived" },
      { type: "project.restored" },
    ]);
  }, 30_000);

  test("rolls back a project update when activity persistence fails", async () => {
    await database.insert(project).values({
      id: "project-1",
      organizationId: "org-1",
      ...storedValues,
    });
    await clientDatabase.exec("DROP TABLE project_activity");
    const store = createDrizzleProjectStore(database as never);

    await expect(
      store.update(actor, "project-1", { name: "Cambio no persistido" }),
    ).rejects.toThrow();
    await expect(
      database
        .select({ name: project.name })
        .from(project)
        .where(eq(project.id, "project-1")),
    ).resolves.toEqual([{ name: "Recurso de apelación" }]);
  }, 30_000);

  test("updates the project period independently from project events", async () => {
    await database.insert(project).values({
      id: "project-1",
      organizationId: "org-1",
      ...storedValues,
    });
    const store = createDrizzleProjectStore(database as never);

    await expect(
      store.update(actor, "project-1", {
        endDate: "2026-08-18",
      }),
    ).resolves.toMatchObject({ status: "updated" });
    const dates = await clientDatabase.query<{
      endDate: string;
    }>(`
      SELECT "end_date"::text AS "endDate"
      FROM "project"
      WHERE "id" = 'project-1'
    `);
    expect(dates.rows).toEqual([{ endDate: "2026-08-18" }]);
  }, 30_000);
});
