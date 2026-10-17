import { describe, expect, test, vi } from "vitest";
import type { SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";

import { member, organization } from "../src/db/auth-schema";
import {
  projectActivity,
  projectAssignment,
} from "../src/db/project-collaboration-schema";
import { project } from "../src/db/project-schema";
import { projectStage } from "../src/db/project-stage-schema";
import { projectTask, taskAssignment } from "../src/db/project-task-schema";
import { createDrizzleProjectTaskStore } from "../src/project-tasks/drizzle-project-task-store";

function queryResult<T>(
  value: T,
  callbacks: {
    onFor?: () => void;
    onFrom?: (table: unknown) => void;
    onInnerJoin?: (table: unknown) => void;
    onOrderBy?: () => void;
    onWhere?: (condition: SQL) => void;
  } = {},
) {
  const query = {
    from: (table: unknown) => {
      callbacks.onFrom?.(table);
      return query;
    },
    innerJoin: (table: unknown) => {
      callbacks.onInnerJoin?.(table);
      return query;
    },
    leftJoin: () => query,
    where: (condition: SQL) => {
      callbacks.onWhere?.(condition);
      return query;
    },
    orderBy: () => {
      callbacks.onOrderBy?.();
      return query;
    },
    groupBy: () => query,
    limit: () => query,
    offset: () => query,
    for: () => {
      callbacks.onFor?.();
      return query;
    },
    then: (resolve: (result: T) => unknown) =>
      Promise.resolve(value).then(resolve),
  };
  return query;
}

const actor = {
  memberId: "member-1",
  userId: "user-1",
  organizationId: "org-1",
  organizationTimeZone: "America/Lima",
  name: "Ana Torres",
  email: "ana@orbit.pe",
  alias: "AT",
};
const now = new Date("2026-08-06T20:00:00.000Z");
const taskRow = {
  id: "task-1",
  organizationId: "org-1",
  projectId: "project-1",
  stageId: "stage-1",
  title: "Revisar antecedentes",
  description: null,
  status: "pending" as const,
  plannedStartDate: null,
  internalDueDate: null,
  position: 0,
  archivedAt: null,
  createdAt: now,
  updatedAt: now,
};

describe("Drizzle project task store", () => {
  test("lists tenant-scoped scheduled tasks with project context and deadlines", async () => {
    const joinedTables: unknown[][] = [];
    let queryIndex = -1;
    const joins = () => {
      queryIndex += 1;
      joinedTables[queryIndex] = [];
      return {
        onInnerJoin: (table: unknown) => joinedTables[queryIndex]!.push(table),
      };
    };
    const db = {
      select: vi
        .fn()
        .mockImplementationOnce(() =>
          queryResult(
            [
              {
                id: "task-1",
                title: "Redactar demanda",
                status: "in_progress",
                plannedStartDate: "2026-08-10",
                internalDueDate: "2026-08-14",
                position: 0,
                projectId: "project-1",
                projectName: "Apelación Constructora",
                projectStartDate: "2026-08-06",
                clientId: "client-1",
                clientName: "Constructora del Sur",
                stageId: "stage-1",
                stageName: "Redacción",
                stagePosition: 2,
              },
            ],
            joins(),
          ),
        )
        .mockImplementationOnce(() =>
          queryResult(
            [
              {
                assignmentId: "assignment-1",
                taskId: "task-1",
                userId: "user-2",
                userName: "Diego Salazar",
                userEmail: "diego@orbit.pe",
                currentMemberId: "member-2",
                currentUserName: "Diego Salazar",
                userAlias: "DS",
                assignedAt: now,
              },
            ],
            joins(),
          ),
        )
        .mockImplementationOnce(() =>
          queryResult(
            [
              {
                projectId: "project-1",
                projectName: "Apelación Constructora",
                clientName: "Constructora del Sur",
                startDate: "2026-08-06",
                endDate: "2026-08-17",
              },
            ],
            joins(),
          ),
        )
        .mockImplementationOnce(() =>
          queryResult(
            [
              {
                projectId: "project-1",
                projectName: "Apelación Constructora",
                clientName: "Constructora del Sur",
                eventId: "event-1",
                eventTitle: "Audiencia",
                eventType: "legal",
                date: "2026-08-21",
              },
            ],
            joins(),
          ),
        )
        .mockImplementationOnce(() => queryResult([{ value: 2 }], joins())),
    };
    const store = createDrizzleProjectTaskStore(db as never);

    await expect(
      store.calendar("org-1", {
        from: "2026-07-27",
        to: "2026-09-06",
        projectIds: [],
        responsibleUserIds: [],
        statuses: [],
        overdueOnly: false,
        today: "2026-08-11",
      }),
    ).resolves.toEqual({
      tasks: [
        expect.objectContaining({
          id: "task-1",
          project: {
            id: "project-1",
            name: "Apelación Constructora",
            startDate: "2026-08-06",
            client: { id: "client-1", name: "Constructora del Sur" },
          },
          stage: { id: "stage-1", name: "Redacción", position: 2 },
          responsibles: [expect.objectContaining({ userAlias: "DS" })],
        }),
      ],
      markers: [
        {
          projectId: "project-1",
          projectName: "Apelación Constructora",
          clientName: "Constructora del Sur",
          kind: "project_start",
          date: "2026-08-06",
        },
        {
          projectId: "project-1",
          projectName: "Apelación Constructora",
          clientName: "Constructora del Sur",
          kind: "project_end",
          date: "2026-08-17",
        },
        {
          projectId: "project-1",
          projectName: "Apelación Constructora",
          clientName: "Constructora del Sur",
          kind: "project_event",
          date: "2026-08-21",
          eventId: "event-1",
          eventTitle: "Audiencia",
          eventType: "legal",
        },
      ],
      undatedTaskCount: 2,
      truncated: false,
    });
    expect(joinedTables[0]).toContain(projectStage);
    expect(joinedTables[4]).toContain(projectStage);
  });

  test("includes project period and event markers when a project has no tasks", async () => {
    const db = {
      select: vi
        .fn()
        .mockImplementationOnce(() => queryResult([]))
        .mockImplementationOnce(() =>
          queryResult([
            {
              projectId: "project-without-tasks",
              projectName: "Consulta sin tareas",
              clientName: "Cliente Uno",
              startDate: "2026-08-12",
              endDate: "2026-08-20",
            },
          ]),
        )
        .mockImplementationOnce(() =>
          queryResult([
            {
              projectId: "project-without-tasks",
              projectName: "Consulta sin tareas",
              clientName: "Cliente Uno",
              eventId: "event-1",
              eventTitle: "Audiencia",
              eventType: "legal",
              date: "2026-08-18",
            },
          ]),
        )
        .mockImplementationOnce(() => queryResult([{ value: 0 }])),
    };
    const store = createDrizzleProjectTaskStore(db as never);

    await expect(
      store.calendar("org-1", {
        from: "2026-08-01",
        to: "2026-08-31",
        projectIds: [],
        responsibleUserIds: [],
        statuses: [],
        overdueOnly: false,
        today: "2026-08-12",
      }),
    ).resolves.toMatchObject({
      tasks: [],
      markers: [
        expect.objectContaining({
          projectId: "project-without-tasks",
          kind: "project_start",
          date: "2026-08-12",
        }),
        expect.objectContaining({
          projectId: "project-without-tasks",
          kind: "project_end",
          date: "2026-08-20",
        }),
        expect.objectContaining({
          projectId: "project-without-tasks",
          kind: "project_event",
          date: "2026-08-18",
        }),
      ],
    });
  });

  test("paginates undated tasks with project, stage, and responsible context", async () => {
    const joinedTables: unknown[][] = [];
    let queryIndex = -1;
    const joins = () => {
      queryIndex += 1;
      joinedTables[queryIndex] = [];
      return {
        onInnerJoin: (table: unknown) => joinedTables[queryIndex]!.push(table),
      };
    };
    const undatedRow = {
      id: "task-undated",
      title: "Revisar anexos",
      status: "pending" as const,
      plannedStartDate: null,
      internalDueDate: null,
      position: 1,
      projectId: "project-1",
      projectName: "Apelación Constructora",
      projectStartDate: "2026-08-06",
      clientId: "client-1",
      clientName: "Constructora del Sur",
      stageId: "stage-1",
      stageName: "Redacción",
      stagePosition: 2,
    };
    const db = {
      select: vi
        .fn()
        .mockImplementationOnce(() => queryResult([undatedRow], joins()))
        .mockImplementationOnce(() => queryResult([{ value: 3 }], joins()))
        .mockImplementationOnce(() => queryResult([], joins())),
    };
    const store = createDrizzleProjectTaskStore(db as never);

    await expect(
      store.listUndated("org-1", {
        page: 2,
        pageSize: 1,
        projectIds: [],
        responsibleUserIds: [],
        statuses: [],
        overdueOnly: false,
        today: "2026-08-11",
      }),
    ).resolves.toEqual({
      tasks: [
        expect.objectContaining({
          id: "task-undated",
          plannedStartDate: null,
          project: expect.objectContaining({ id: "project-1" }),
          stage: expect.objectContaining({ name: "Redacción" }),
          responsibles: [],
        }),
      ],
      total: 3,
    });
    expect(joinedTables[1]).toContain(projectStage);
  });

  test.each([
    "create",
    "update",
    "replaceResponsibles",
    "archive",
    "restore",
  ] as const)(
    "rejects %s before changing an archived project",
    async (operation) => {
      const transaction = {
        select: vi
          .fn()
          .mockImplementationOnce(() => queryResult([actor]))
          .mockImplementationOnce(() =>
            queryResult([
              {
                id: "project-1",
                startDate: "2026-08-06",
                archivedAt: new Date("2026-08-10T12:00:00.000Z"),
              },
            ]),
          ),
        insert: vi.fn(),
        update: vi.fn(),
      };
      const store = createDrizzleProjectTaskStore({
        transaction: vi.fn(async (callback) => callback(transaction)),
      } as never);

      const result =
        operation === "create"
          ? await store.create({
              actor,
              id: "task-new",
              projectId: "project-1",
              stageId: "stage-1",
              title: "Tarea",
              description: null,
              status: "pending",
              plannedStartDate: null,
              internalDueDate: null,
              responsibleUserIds: [],
            })
          : operation === "update"
            ? await store.update({
                actor,
                projectId: "project-1",
                taskId: "task-1",
                values: { title: "Cambio" },
              })
            : operation === "replaceResponsibles"
              ? await store.replaceResponsibles({
                  actor,
                  projectId: "project-1",
                  taskId: "task-1",
                  responsibleUserIds: [],
                })
              : await store[operation]({
                  actor,
                  projectId: "project-1",
                  taskId: "task-1",
                });

      expect(result).toEqual({ status: "project_archived" });
      expect(transaction.insert).not.toHaveBeenCalled();
      expect(transaction.update).not.toHaveBeenCalled();
    },
  );

  test("finds an archived task with current responsible identity fields", async () => {
    const archivedAt = new Date("2026-08-07T20:00:00.000Z");
    const db = {
      select: vi
        .fn()
        .mockImplementationOnce(() =>
          queryResult([
            {
              ...taskRow,
              stageName: "Investigación",
              stagePosition: 0,
              archivedAt,
            },
          ]),
        )
        .mockImplementationOnce(() =>
          queryResult([
            {
              assignmentId: "assignment-1",
              taskId: "task-1",
              userId: "user-2",
              userName: "Luis Ramos",
              userEmail: "luis@orbit.pe",
              currentMemberId: "member-2",
              currentUserName: "Luis Renombrado",
              userAlias: "LR",
              userPosition: "senior",
              assignedAt: now,
            },
          ]),
        ),
    };
    const store = createDrizzleProjectTaskStore(db as never);

    await expect(
      store.find("org-1", "project-1", "task-1"),
    ).resolves.toMatchObject({
      id: "task-1",
      archivedAt,
      responsibles: [
        {
          userId: "user-2",
          userName: "Luis Ramos",
          userEmail: "luis@orbit.pe",
          userAlias: "LR",
          userPosition: "senior",
          activeStudioMember: true,
        },
      ],
    });
  });

  test("does not find a task outside the requested tenant scope", async () => {
    const captured: Array<{ sql: string; params: unknown[] }> = [];
    const db = {
      select: vi.fn(() =>
        queryResult([], {
          onWhere: (condition) => {
            captured.push(new PgDialect().sqlToQuery(condition));
          },
        }),
      ),
    };
    const store = createDrizzleProjectTaskStore(db as never);

    await expect(
      store.find("org-1", "project-1", "task-from-org-2"),
    ).resolves.toBeNull();
    expect(db.select).toHaveBeenCalledOnce();
    expect(captured).toMatchObject([
      {
        sql: expect.stringContaining('"project_task"."organization_id" = $1'),
        params: ["org-1", "project-1", "task-from-org-2"],
      },
    ]);
  });

  test("rejects a task planned before the project start inside the lock", async () => {
    const transaction = {
      select: vi
        .fn()
        .mockImplementationOnce(() => queryResult([actor]))
        .mockImplementationOnce(() =>
          queryResult([{ id: "project-1", startDate: "2026-08-06" }]),
        ),
      insert: vi.fn(),
    };
    const store = createDrizzleProjectTaskStore({
      transaction: vi.fn(async (callback) => callback(transaction)),
    } as never);

    await expect(
      store.create({
        actor,
        id: "task-1",
        projectId: "project-1",
        stageId: "stage-1",
        title: "Revisar antecedentes",
        description: null,
        status: "pending",
        plannedStartDate: "2026-08-05",
        internalDueDate: "2026-08-10",
        responsibleUserIds: [],
      }),
    ).resolves.toEqual({ status: "invalid_dates" });
    expect(transaction.insert).not.toHaveBeenCalled();
  });

  test("rejects a task deadline before the project start inside the lock", async () => {
    const selectResults = [
      [actor],
      [{ id: "project-1", startDate: "2026-08-06" }],
      [{ id: "stage-1", name: "Investigación", position: 0 }],
      [{ value: null }],
      [],
    ];
    const transaction = {
      select: vi.fn(() => queryResult(selectResults.shift() ?? [])),
      insert: vi.fn((table) => ({
        values: vi.fn((values) =>
          table === projectTask
            ? {
                returning: vi
                  .fn()
                  .mockResolvedValue([{ ...taskRow, ...values }]),
              }
            : Promise.resolve(),
        ),
      })),
    };
    const store = createDrizzleProjectTaskStore({
      transaction: vi.fn(async (callback) => callback(transaction)),
    } as never);

    await expect(
      store.create({
        actor,
        id: "task-1",
        projectId: "project-1",
        stageId: "stage-1",
        title: "Revisar antecedentes",
        description: null,
        status: "pending",
        plannedStartDate: null,
        internalDueDate: "2026-08-05",
        responsibleUserIds: [],
      }),
    ).resolves.toEqual({ status: "invalid_dates" });
    expect(transaction.insert).not.toHaveBeenCalled();
  });

  test("rejects clearing a planned start while the stored deadline remains", async () => {
    const current = {
      ...taskRow,
      plannedStartDate: "2026-08-08",
      internalDueDate: "2026-08-14",
      stageName: "Investigación",
      stagePosition: 0,
    };
    const selectResults = [
      [actor],
      [{ id: "project-1", startDate: "2026-08-06" }],
      [current],
      [],
    ];
    const updateQuery = {
      set: vi.fn(() => updateQuery),
      where: vi.fn(() => ({
        returning: vi
          .fn()
          .mockResolvedValue([{ ...current, plannedStartDate: null }]),
      })),
    };
    const transaction = {
      select: vi.fn(() => queryResult(selectResults.shift() ?? [])),
      update: vi.fn(() => updateQuery),
      insert: vi.fn(() => ({ values: vi.fn().mockResolvedValue([]) })),
    };
    const store = createDrizzleProjectTaskStore({
      transaction: vi.fn(async (callback) => callback(transaction)),
    } as never);

    await expect(
      store.update({
        actor,
        projectId: "project-1",
        taskId: "task-1",
        values: { plannedStartDate: null },
      }),
    ).resolves.toEqual({ status: "invalid_dates" });
    expect(transaction.update).not.toHaveBeenCalled();
  });

  test.each([
    {
      name: "project start clamp",
      plannedStartDate: null,
      automaticPlannedStartDate: "2026-08-01",
      internalDueDate: null,
      expected: "2026-08-06",
    },
    {
      name: "internal deadline clamp",
      plannedStartDate: null,
      automaticPlannedStartDate: "2026-08-20",
      internalDueDate: "2026-08-10",
      expected: "2026-08-10",
    },
    {
      name: "explicit start preservation",
      plannedStartDate: "2026-08-08",
      automaticPlannedStartDate: "2026-08-09",
      internalDueDate: "2026-08-10",
      expected: "2026-08-08",
    },
  ])(
    "applies automatic starts during creation: $name",
    async ({
      plannedStartDate,
      automaticPlannedStartDate,
      internalDueDate,
      expected,
    }) => {
      let insertedTask: Record<string, unknown> | undefined;
      const selectResults = [
        [actor],
        [{ id: "project-1", startDate: "2026-08-06" }],
        [{ id: "stage-1", name: "Investigación", position: 0 }],
        [{ value: null }],
        [],
      ];
      const transaction = {
        select: vi.fn(() => queryResult(selectResults.shift() ?? [])),
        insert: vi.fn((table) => ({
          values: vi.fn((values) => {
            if (table === projectTask) {
              insertedTask = values as Record<string, unknown>;
              return {
                returning: vi.fn().mockResolvedValue([
                  {
                    ...taskRow,
                    ...insertedTask,
                  },
                ]),
              };
            }
            return Promise.resolve();
          }),
        })),
      };
      const store = createDrizzleProjectTaskStore({
        transaction: vi.fn(async (callback) => callback(transaction)),
      } as never);

      await expect(
        store.create({
          actor,
          id: "task-1",
          projectId: "project-1",
          stageId: "stage-1",
          title: "Revisar antecedentes",
          description: null,
          status: "in_progress",
          plannedStartDate,
          automaticPlannedStartDate,
          internalDueDate,
          responsibleUserIds: [],
        }),
      ).resolves.toMatchObject({ status: "created" });
      expect(insertedTask?.plannedStartDate).toBe(expected);
      expect(insertedTask).not.toHaveProperty("automaticPlannedStartDate");
    },
  );

  test("builds ordered stage ranges and uses project start for the first stage", async () => {
    let taskWhere: { sql: string; params: unknown[] } | undefined;
    const db = {
      select: vi
        .fn()
        .mockImplementationOnce(() =>
          queryResult([
            {
              startDate: "2026-08-06",
              endDate: "2026-08-20",
              timeZone: "America/Lima",
            },
          ]),
        )
        .mockImplementationOnce(() =>
          queryResult([
            { id: "stage-1", name: "Investigación", position: 0 },
            { id: "stage-2", name: "Informe", position: 1 },
          ]),
        )
        .mockImplementationOnce(() =>
          queryResult(
            [
              {
                id: "task-1",
                title: "Revisar antecedentes",
                stageId: "stage-1",
                status: "pending",
                plannedStartDate: "2026-08-08",
                internalDueDate: "2026-08-12",
                position: 0,
              },
              {
                id: "task-2",
                title: "Preparar informe",
                stageId: "stage-2",
                status: "in_progress",
                plannedStartDate: "2026-08-11",
                internalDueDate: "2026-08-19",
                position: 1,
              },
              {
                id: "task-3",
                title: "Validar conclusiones",
                stageId: "stage-2",
                status: "completed",
                plannedStartDate: "2026-08-13",
                internalDueDate: "2026-08-21",
                position: 0,
              },
              {
                id: "task-4",
                title: "Coordinar anexos",
                stageId: "stage-2",
                status: "pending",
                plannedStartDate: null,
                internalDueDate: null,
                position: 1,
              },
            ],
            {
              onWhere: (condition) => {
                taskWhere = new PgDialect().sqlToQuery(condition);
              },
            },
          ),
        )
        .mockImplementationOnce(() => queryResult([])),
    };
    const store = createDrizzleProjectTaskStore(db as never);

    await expect(store.schedule("org-1", "project-1")).resolves.toMatchObject({
      projectExists: true,
      schedule: {
        project: { timeZone: "America/Lima", endDate: "2026-08-20" },
        events: [],
        stages: [
          {
            id: "stage-1",
            startDate: "2026-08-06",
            endDate: "2026-08-12",
            taskStatusCounts: {
              pending: 1,
              inProgress: 0,
              blocked: 0,
              completed: 0,
            },
            tasks: [
              {
                id: "task-1",
                title: "Revisar antecedentes",
                status: "pending",
                plannedStartDate: "2026-08-08",
                internalDueDate: "2026-08-12",
                position: 0,
              },
            ],
            usesProjectStartFallback: true,
          },
          {
            id: "stage-2",
            startDate: "2026-08-11",
            endDate: "2026-08-21",
            scheduledTaskCount: 2,
            taskStatusCounts: {
              pending: 1,
              inProgress: 1,
              blocked: 0,
              completed: 1,
            },
            tasks: [
              {
                id: "task-3",
                title: "Validar conclusiones",
                status: "completed",
                plannedStartDate: "2026-08-13",
                internalDueDate: "2026-08-21",
                position: 0,
              },
              {
                id: "task-2",
                title: "Preparar informe",
                status: "in_progress",
                plannedStartDate: "2026-08-11",
                internalDueDate: "2026-08-19",
                position: 1,
              },
              {
                id: "task-4",
                title: "Coordinar anexos",
                status: "pending",
                plannedStartDate: null,
                internalDueDate: null,
                position: 1,
              },
            ],
          },
        ],
      },
    });
    expect(db.select).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ timeZone: organization.timeZone }),
    );
    expect(taskWhere).toMatchObject({
      sql: expect.stringContaining('"project_task"."archived_at" is null'),
      params: ["org-1", "project-1"],
    });
  });

  test("rolls task, assignments, and activity into one create transaction", async () => {
    const responsible = {
      userId: "user-2",
      userName: "Luis Ramos",
      userEmail: "luis@orbit.pe",
      userAlias: "LR",
    };
    const selectResults = [
      [actor],
      [{ id: "project-1", startDate: "2026-08-06" }],
      [{ id: "stage-1", name: "Investigación", position: 0 }],
      [{ value: null }],
      [responsible],
    ];
    const outsideInsert = vi.fn();
    const transactionInsert = vi.fn((table) => ({
      values: vi.fn((values) => {
        if (table === projectActivity) {
          return Promise.reject(new Error("activity failed"));
        }
        return {
          returning: vi.fn().mockResolvedValue(
            table === projectTask
              ? [
                  {
                    ...taskRow,
                    ...(Array.isArray(values) ? values[0] : values),
                  },
                ]
              : Array.isArray(values)
                ? values
                : [values],
          ),
        };
      }),
    }));
    const transaction = {
      select: vi.fn(() => queryResult(selectResults.shift() ?? [])),
      insert: transactionInsert,
    };
    const db = {
      insert: outsideInsert,
      transaction: vi.fn(async (callback) => callback(transaction)),
    };
    const ids = ["assignment-1", "activity-1", "activity-2"];
    const store = createDrizzleProjectTaskStore(
      db as never,
      () => ids.shift() ?? "generated-id",
    );

    await expect(
      store.create({
        actor,
        id: "task-1",
        projectId: "project-1",
        stageId: "stage-1",
        title: "Revisar antecedentes",
        description: null,
        status: "pending",
        plannedStartDate: null,
        internalDueDate: null,
        responsibleUserIds: ["user-2"],
      }),
    ).rejects.toThrow("activity failed");

    expect(db.transaction).toHaveBeenCalledOnce();
    expect(transactionInsert).toHaveBeenCalledWith(projectTask);
    expect(transactionInsert).toHaveBeenCalledWith(taskAssignment);
    expect(transactionInsert).toHaveBeenCalledWith(projectActivity);
    expect(outsideInsert).not.toHaveBeenCalled();
  });

  test("lists tasks in server stage order with active responsibles", async () => {
    let ordered = false;
    const db = {
      select: vi
        .fn()
        .mockImplementationOnce(() => queryResult([{ id: "project-1" }]))
        .mockImplementationOnce(() =>
          queryResult(
            [
              {
                ...taskRow,
                stageName: "Investigación",
                stagePosition: 0,
              },
            ],
            { onOrderBy: () => (ordered = true) },
          ),
        )
        .mockImplementationOnce(() => queryResult([{ value: 1 }]))
        .mockImplementationOnce(() =>
          queryResult([
            {
              assignmentId: "assignment-1",
              taskId: "task-1",
              userId: "user-2",
              userName: "Luis Ramos",
              userEmail: "luis@orbit.pe",
              currentMemberId: "member-2",
              currentUserName: "Renamed Member",
              userAlias: null,
              userPosition: "senior",
              assignedAt: now,
            },
            {
              assignmentId: "assignment-former",
              taskId: "task-1",
              userId: "user-former",
              userName: "Former Member",
              userEmail: "former@orbit.pe",
              currentMemberId: null,
              currentUserName: null,
              userAlias: null,
              userPosition: "partner",
              assignedAt: now,
            },
          ]),
        ),
    };
    const store = createDrizzleProjectTaskStore(db as never);

    await expect(
      store.list("org-1", "project-1", {
        view: "active",
        page: 1,
        pageSize: 25,
      }),
    ).resolves.toMatchObject({
      projectExists: true,
      total: 1,
      tasks: [
        {
          id: "task-1",
          stageName: "Investigación",
          responsibles: [
            {
              userAlias: "RM",
              activeStudioMember: true,
              userName: "Luis Ramos",
              userPosition: "senior",
            },
            {
              userAlias: "FM",
              activeStudioMember: false,
              userName: "Former Member",
              userPosition: null,
            },
          ],
        },
      ],
    });
    expect(ordered).toBe(true);
  });

  test("archives a task without ending responsible assignments", async () => {
    const current = {
      ...taskRow,
      stageName: "Investigación",
      stagePosition: 0,
    };
    const selectResults = [
      [actor],
      [{ id: "project-1", startDate: "2026-08-06", archivedAt: null }],
      [current],
      [],
    ];
    const transaction = {
      select: vi.fn(() => queryResult(selectResults.shift() ?? [])),
      update: vi.fn((table) => {
        expect(table).toBe(projectTask);
        const query = {
          set: vi.fn(() => query),
          where: vi.fn(() => ({
            returning: vi
              .fn()
              .mockResolvedValue([{ ...taskRow, archivedAt: now }]),
          })),
        };
        return query;
      }),
      insert: vi.fn(() => ({ values: vi.fn().mockResolvedValue([]) })),
    };
    const store = createDrizzleProjectTaskStore({
      transaction: vi.fn(async (callback) => callback(transaction)),
    } as never);

    await expect(
      store.archive({ actor, projectId: "project-1", taskId: "task-1" }),
    ).resolves.toMatchObject({
      status: "updated",
      task: { id: "task-1", archivedAt: expect.any(Date) },
    });
    expect(transaction.update).toHaveBeenCalledOnce();
  });

  test("maps active responsibility uniqueness to a conflict", async () => {
    const store = createDrizzleProjectTaskStore({
      transaction: vi.fn().mockRejectedValue({
        code: "23505",
        constraint_name: "task_assignment_active_user_unique",
      }),
    } as never);

    await expect(
      store.replaceResponsibles({
        actor,
        projectId: "project-1",
        taskId: "task-1",
        responsibleUserIds: ["user-2"],
      }),
    ).resolves.toEqual({ status: "conflict" });
  });

  test("locks project assignments before task assignments during replacement", async () => {
    const lockOrder: unknown[] = [];
    const selectResults = [
      { label: "actor", rows: [actor] },
      {
        label: "project",
        rows: [{ id: "project-1", startDate: "2026-08-06", archivedAt: null }],
      },
      {
        label: "task",
        rows: [
          {
            ...taskRow,
            stageName: "Investigación",
            stagePosition: 0,
          },
        ],
      },
      {
        label: "project-assignments",
        rows: [
          {
            userId: "user-2",
            userName: "Luis Ramos",
            userEmail: "luis@orbit.pe",
            userAlias: "LR",
          },
        ],
      },
      { label: "task-assignments", rows: [] },
      {
        rows: [
          {
            assignmentId: "task-assignment-1",
            taskId: "task-1",
            userId: "user-2",
            userName: "Luis Ramos",
            userEmail: "luis@orbit.pe",
            currentMemberId: "member-2",
            userAlias: "LR",
            assignedAt: now,
          },
        ],
      },
    ];
    const transaction = {
      select: vi.fn(() => {
        const result = selectResults.shift() ?? { rows: [] };
        let selectedTable: unknown;
        return queryResult(result.rows, {
          onFrom: (table) => (selectedTable = table),
          onFor: () => lockOrder.push(selectedTable),
        });
      }),
      insert: vi.fn((table) => ({
        values: vi.fn(() =>
          table === projectActivity ? Promise.resolve([]) : Promise.resolve([]),
        ),
      })),
      update: vi.fn(),
    };
    const store = createDrizzleProjectTaskStore(
      {
        transaction: vi.fn(async (callback) => callback(transaction)),
      } as never,
      () => "generated-id",
    );

    await store.replaceResponsibles({
      actor,
      projectId: "project-1",
      taskId: "task-1",
      responsibleUserIds: ["user-2"],
    });

    expect(lockOrder).toEqual([
      member,
      project,
      projectTask,
      projectAssignment,
      taskAssignment,
    ]);
  });

  test("locks the project before moving a task to another stage", async () => {
    const lockOrder: unknown[] = [];
    let taskSelectCount = 0;
    const transaction = {
      select: vi.fn(() => {
        let selectedTable: unknown;
        const query = {
          from: (table: unknown) => {
            selectedTable = table;
            return query;
          },
          innerJoin: () => query,
          leftJoin: () => query,
          where: () => query,
          orderBy: () => query,
          limit: () => query,
          for: () => {
            lockOrder.push(selectedTable);
            return query;
          },
          then: (resolve: (rows: unknown[]) => unknown) => {
            let rows: unknown[] = [];
            if (selectedTable === member) rows = [actor];
            if (selectedTable === project) rows = [{ id: "project-1" }];
            if (selectedTable === projectTask) {
              rows =
                taskSelectCount++ === 0
                  ? [
                      {
                        ...taskRow,
                        stageName: "Investigación",
                        stagePosition: 0,
                      },
                    ]
                  : [{ value: null }];
            }
            if (selectedTable === projectStage) {
              rows = [{ id: "stage-2", name: "Informe", position: 1 }];
            }
            return Promise.resolve(rows).then(resolve);
          },
        };
        return query;
      }),
      update: vi.fn(() => {
        const query = {
          set: vi.fn(() => query),
          where: vi.fn(() => ({
            returning: vi
              .fn()
              .mockResolvedValue([
                { ...taskRow, stageId: "stage-2", position: 0 },
              ]),
          })),
        };
        return query;
      }),
      insert: vi.fn(() => ({ values: vi.fn().mockResolvedValue([]) })),
    };
    const store = createDrizzleProjectTaskStore({
      transaction: vi.fn(async (callback) => callback(transaction)),
    } as never);

    await store.update({
      actor,
      projectId: "project-1",
      taskId: "task-1",
      values: { stageId: "stage-2" },
    });

    expect(lockOrder).toEqual([member, project, projectTask]);
  });

  test("records explicit task detail and date changes in the update transaction", async () => {
    const current = {
      ...taskRow,
      title: "Título anterior",
      plannedStartDate: "2026-08-12",
      stageName: "Investigación",
      stagePosition: 0,
    };
    const selectResults = [
      [actor],
      [{ id: "project-1", startDate: "2026-08-06" }],
      [current],
      [],
    ];
    let updatePatch: Record<string, unknown> = {};
    let insertedActivities: Array<{
      type: string;
      details: Record<string, string | null>;
    }> = [];
    const transaction = {
      select: vi.fn(() => queryResult(selectResults.shift() ?? [])),
      update: vi.fn(() => {
        const query = {
          set: vi.fn((patch) => {
            updatePatch = patch as Record<string, unknown>;
            return query;
          }),
          where: vi.fn(() => ({
            returning: vi.fn().mockImplementation(async () => [
              {
                ...current,
                ...updatePatch,
              },
            ]),
          })),
        };
        return query;
      }),
      insert: vi.fn((table) => ({
        values: vi.fn((values) => {
          if (table === projectActivity) {
            insertedActivities = Array.isArray(values) ? values : [values];
          }
          return Promise.resolve([]);
        }),
      })),
    };
    const store = createDrizzleProjectTaskStore(
      {
        transaction: vi.fn(async (callback) => callback(transaction)),
      } as never,
      () => "activity-id",
    );

    await store.update({
      actor,
      projectId: "project-1",
      taskId: "task-1",
      values: {
        title: "Nuevo título",
        description: "Nueva descripción",
        plannedStartDate: "2026-08-13",
        internalDueDate: "2026-08-20",
      },
    });

    expect(insertedActivities).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "task.details_changed",
          details: {
            taskId: "task-1",
            taskTitle: "Nuevo título",
            previousTitle: "Título anterior",
            newTitle: "Nuevo título",
            previousDescription: null,
            newDescription: "Nueva descripción",
          },
        }),
        expect.objectContaining({
          type: "task.dates_changed",
          details: {
            taskId: "task-1",
            taskTitle: "Nuevo título",
            previousPlannedStartDate: "2026-08-12",
            newPlannedStartDate: "2026-08-13",
            previousInternalDueDate: null,
            newInternalDueDate: "2026-08-20",
          },
        }),
      ]),
    );
  });

  test.each([
    {
      name: "pending to in progress",
      currentStatus: "pending" as const,
      currentStart: null,
      internalDueDate: null,
      values: {
        status: "in_progress" as const,
        automaticPlannedStartDate: "2026-08-08",
      },
      expectedStart: "2026-08-08",
      expectedAutomatic: "2026-08-08",
    },
    {
      name: "overdue completion",
      currentStatus: "pending" as const,
      currentStart: null,
      internalDueDate: "2026-08-14",
      values: {
        status: "completed" as const,
        automaticPlannedStartDate: "2026-08-20",
      },
      expectedStart: "2026-08-14",
      expectedAutomatic: "2026-08-14",
    },
    {
      name: "manual start preservation",
      currentStatus: "in_progress" as const,
      currentStart: "2026-08-08",
      internalDueDate: "2026-08-14",
      values: {
        status: "completed" as const,
        automaticPlannedStartDate: "2026-08-09",
      },
      expectedStart: "2026-08-08",
      expectedAutomatic: null,
    },
    {
      name: "unrelated edit",
      currentStatus: "in_progress" as const,
      currentStart: null,
      internalDueDate: null,
      values: { title: "Editar título" },
      expectedStart: null,
      expectedAutomatic: null,
    },
    {
      name: "unchanged status resubmission",
      currentStatus: "in_progress" as const,
      currentStart: null,
      internalDueDate: null,
      values: {
        status: "in_progress" as const,
        automaticPlannedStartDate: "2026-08-09",
      },
      expectedStart: null,
      expectedAutomatic: null,
    },
  ])(
    "applies automatic starts during update: $name",
    async ({
      currentStatus,
      currentStart,
      internalDueDate,
      values,
      expectedStart,
      expectedAutomatic,
    }) => {
      const current = {
        ...taskRow,
        status: currentStatus,
        plannedStartDate: currentStart,
        internalDueDate,
        stageName: "Investigación",
        stagePosition: 0,
      };
      const selectResults = [
        [actor],
        [{ id: "project-1", startDate: "2026-08-06" }],
        [current],
        [],
      ];
      let updatePatch: Record<string, unknown> | undefined;
      let activities: Array<{ details: Record<string, string | null> }> = [];
      const transaction = {
        select: vi.fn(() => queryResult(selectResults.shift() ?? [])),
        update: vi.fn(() => {
          const query = {
            set: vi.fn((patch) => {
              updatePatch = patch as Record<string, unknown>;
              return query;
            }),
            where: vi.fn(() => ({
              returning: vi.fn().mockImplementation(async () => [
                {
                  ...current,
                  ...updatePatch,
                },
              ]),
            })),
          };
          return query;
        }),
        insert: vi.fn((table) => ({
          values: vi.fn((inserted) => {
            if (table === projectActivity) {
              activities = inserted as typeof activities;
            }
            return Promise.resolve();
          }),
        })),
      };
      const store = createDrizzleProjectTaskStore({
        transaction: vi.fn(async (callback) => callback(transaction)),
      } as never);

      await expect(
        store.update({
          actor,
          projectId: "project-1",
          taskId: "task-1",
          values,
        }),
      ).resolves.toMatchObject({
        status: "updated",
        task: { plannedStartDate: expectedStart },
      });
      expect(updatePatch).not.toHaveProperty("automaticPlannedStartDate");
      if (expectedAutomatic) {
        expect(updatePatch).toHaveProperty(
          "plannedStartDate",
          expectedAutomatic,
        );
        expect(activities[0]?.details).toEqual(
          expect.objectContaining({
            previousStatus: currentStatus,
            newStatus: (values as { status: string }).status,
            automaticPlannedStartDate: expectedAutomatic,
          }),
        );
      } else {
        expect(updatePatch).not.toHaveProperty("plannedStartDate");
        if (activities[0]) {
          expect(activities[0].details).not.toHaveProperty(
            "automaticPlannedStartDate",
          );
        } else {
          expect(activities).toEqual([]);
        }
      }
    },
  );
});
