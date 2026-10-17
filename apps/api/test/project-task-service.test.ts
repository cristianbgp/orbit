import { describe, expect, test, vi } from "vitest";

import {
  createProjectTaskService,
  ProjectTaskServiceError,
  type ProjectTaskStore,
} from "../src/project-tasks/project-task-service";
import type {
  ActiveProjectTaskMember,
  ProjectTaskRecord,
} from "../src/project-tasks/project-task-types";

const actor = { userId: "user-1", organizationId: "org-1" };
const activeMember: ActiveProjectTaskMember = {
  memberId: "member-1",
  userId: "user-1",
  organizationId: "org-1",
  organizationTimeZone: "America/Lima",
  name: "Ana Torres",
  email: "ana@orbit.pe",
};
const now = new Date("2026-08-06T20:00:00.000Z");
const task: ProjectTaskRecord = {
  id: "task-1",
  organizationId: "org-1",
  projectId: "project-1",
  stageId: "stage-1",
  stageName: "Investigación",
  stagePosition: 0,
  title: "Revisar antecedentes",
  description: null,
  status: "pending",
  plannedStartDate: null,
  internalDueDate: null,
  position: 0,
  archivedAt: null,
  responsibles: [],
  createdAt: now,
  updatedAt: now,
};

function createStore(
  overrides: Partial<ProjectTaskStore> = {},
): ProjectTaskStore {
  return {
    findActiveMember: vi.fn().mockResolvedValue(activeMember),
    find: vi.fn().mockResolvedValue(task),
    list: vi.fn().mockResolvedValue({
      projectExists: true,
      tasks: [],
      total: 0,
    }),
    calendar: vi.fn().mockResolvedValue({
      tasks: [],
      deadlines: [],
      undatedTaskCount: 0,
      truncated: false,
    }),
    listUndated: vi.fn().mockResolvedValue({ tasks: [], total: 0 }),
    schedule: vi.fn().mockResolvedValue({
      projectExists: true,
      schedule: {
        project: {
          startDate: "2026-08-06",
          endDate: "2026-08-14",
          timeZone: "America/Lima",
        },
        events: [],
        stages: [],
      },
    }),
    create: vi.fn().mockResolvedValue({ status: "created", task }),
    update: vi.fn().mockResolvedValue({ status: "updated", task }),
    replaceResponsibles: vi.fn().mockResolvedValue({ status: "updated", task }),
    archive: vi.fn().mockResolvedValue({
      status: "updated",
      task: { ...task, archivedAt: now },
    }),
    restore: vi.fn().mockResolvedValue({ status: "updated", task }),
    ...overrides,
  };
}

describe("project task service", () => {
  test("normalizes studio calendar filters in the organization timezone", async () => {
    const store = createStore();
    const service = createProjectTaskService(
      store,
      () => "unused",
      () => new Date("2026-08-07T00:30:00.000Z"),
    );

    await service.calendar(actor, {
      from: "2026-07-27",
      to: "2026-09-06",
      projectIds: ["project-2", "project-2", "project-1"],
      responsibleUserIds: ["user-2", "user-2"],
      statuses: ["blocked", "blocked", "pending"],
      search: "  apelación  ",
      overdueOnly: true,
    });

    expect(store.calendar).toHaveBeenCalledWith("org-1", {
      from: "2026-07-27",
      to: "2026-09-06",
      projectIds: ["project-2", "project-1"],
      responsibleUserIds: ["user-2"],
      statuses: ["blocked", "pending"],
      search: "apelación",
      overdueOnly: true,
      today: "2026-08-06",
    });
  });

  test("paginates matching undated work after membership validation", async () => {
    const store = createStore({
      listUndated: vi.fn().mockResolvedValue({ tasks: [], total: 26 }),
    });
    const service = createProjectTaskService(store);

    await expect(
      service.listUndated(actor, {
        projectIds: [],
        responsibleUserIds: [],
        statuses: [],
        overdueOnly: false,
        page: 2,
        pageSize: 25,
      }),
    ).resolves.toEqual({
      tasks: [],
      pagination: { page: 2, pageSize: 25, total: 26, totalPages: 2 },
    });
  });

  test("returns an active task scoped to the actor organization", async () => {
    const store = createStore();
    const service = createProjectTaskService(store);

    await expect(service.get(actor, "project-1", "task-1")).resolves.toEqual(
      task,
    );
    expect(store.find).toHaveBeenCalledWith("org-1", "project-1", "task-1");
  });

  test("returns an archived task", async () => {
    const archivedTask = { ...task, archivedAt: now };
    const service = createProjectTaskService(
      createStore({ find: vi.fn().mockResolvedValue(archivedTask) }),
    );

    await expect(service.get(actor, "project-1", "task-1")).resolves.toEqual(
      archivedTask,
    );
  });

  test("reports an unavailable task as not found", async () => {
    const service = createProjectTaskService(
      createStore({ find: vi.fn().mockResolvedValue(null) }),
    );

    await expect(service.get(actor, "project-1", "missing")).rejects.toEqual(
      new ProjectTaskServiceError("NOT_FOUND", "Tarea no encontrada."),
    );
  });

  test("rejects task reads when the actor is not an active studio member", async () => {
    const store = createStore({
      findActiveMember: vi.fn().mockResolvedValue(null),
    });
    const service = createProjectTaskService(store);

    await expect(service.get(actor, "project-1", "task-1")).rejects.toEqual(
      new ProjectTaskServiceError(
        "FORBIDDEN",
        "No tienes acceso a este estudio.",
      ),
    );
    expect(store.find).not.toHaveBeenCalled();
  });

  test("allows an active studio member to list tasks with defaults", async () => {
    const store = createStore();
    const service = createProjectTaskService(store);

    await expect(service.list(actor, "project-1", {})).resolves.toEqual({
      tasks: [],
      pagination: {
        page: 1,
        pageSize: 25,
        total: 0,
        totalPages: 0,
      },
    });
    expect(store.list).toHaveBeenCalledWith("org-1", "project-1", {
      view: "active",
      page: 1,
      pageSize: 25,
      stageId: undefined,
    });
  });

  test("forwards a stage filter to task persistence", async () => {
    const store = createStore();
    const service = createProjectTaskService(store);

    await service.list(actor, "project-1", { stageId: "stage-2" });

    expect(store.list).toHaveBeenCalledWith("org-1", "project-1", {
      view: "active",
      page: 1,
      pageSize: 25,
      stageId: "stage-2",
    });
  });

  test("rejects a missing studio membership before task persistence", async () => {
    const store = createStore({
      findActiveMember: vi.fn().mockResolvedValue(null),
    });
    const service = createProjectTaskService(store);

    await expect(service.list(actor, "project-1", {})).rejects.toEqual(
      new ProjectTaskServiceError(
        "FORBIDDEN",
        "No tienes acceso a este estudio.",
      ),
    );
    expect(store.list).not.toHaveBeenCalled();
  });

  test("normalizes optional fields and defaults a new task to pending", async () => {
    const store = createStore();
    const service = createProjectTaskService(store, () => "task-new");

    await service.create(actor, "project-1", {
      title: "  Revisar antecedentes  ",
      stageId: "stage-1",
      description: "   ",
      responsibleUserIds: [],
    });

    expect(store.create).toHaveBeenCalledWith({
      actor: activeMember,
      id: "task-new",
      projectId: "project-1",
      stageId: "stage-1",
      title: "Revisar antecedentes",
      description: null,
      status: "pending",
      plannedStartDate: null,
      internalDueDate: null,
      responsibleUserIds: [],
    });
  });

  test.each([
    ["pending", undefined],
    ["blocked", undefined],
    ["in_progress", "2026-08-06"],
    ["completed", "2026-08-06"],
  ] as const)(
    "derives an automatic start candidate for create status %s",
    async (status, expected) => {
      const store = createStore();
      const service = createProjectTaskService(
        store,
        () => "task-new",
        () => new Date("2026-08-07T00:30:00.000Z"),
      );

      await service.create(actor, "project-1", {
        title: "Preparar escrito",
        stageId: "stage-1",
        status,
      });

      const values = vi.mocked(store.create).mock.calls[0]![0];
      if (expected) {
        expect(values).toHaveProperty("automaticPlannedStartDate", expected);
      } else {
        expect(values).not.toHaveProperty("automaticPlannedStartDate");
      }
    },
  );

  test("derives an automatic start candidate only for qualifying update payloads", async () => {
    const store = createStore();
    const service = createProjectTaskService(
      store,
      () => "unused",
      () => new Date("2026-08-07T00:30:00.000Z"),
    );

    await service.update(actor, "project-1", "task-1", {
      status: "completed",
    });
    await service.update(actor, "project-1", "task-1", {
      title: "Nuevo título",
    });

    expect(store.update).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        values: {
          status: "completed",
          automaticPlannedStartDate: "2026-08-06",
        },
      }),
    );
    expect(store.update).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ values: { title: "Nuevo título" } }),
    );
  });

  test("normalizes nullable updates without changing omitted fields", async () => {
    const store = createStore();
    const service = createProjectTaskService(store);

    await service.update(actor, "project-1", "task-1", {
      title: "  Preparar informe  ",
      description: " ",
      plannedStartDate: "2026-08-08",
      internalDueDate: null,
    });

    expect(store.update).toHaveBeenCalledWith({
      actor: activeMember,
      projectId: "project-1",
      taskId: "task-1",
      values: {
        title: "Preparar informe",
        description: null,
        plannedStartDate: "2026-08-08",
        internalDueDate: null,
      },
    });
  });

  test("rejects a planned start after the task deadline", async () => {
    const store = createStore();
    const service = createProjectTaskService(store);

    await expect(
      service.create(actor, "project-1", {
        title: "Preparar escrito",
        stageId: "stage-1",
        plannedStartDate: "2026-08-12",
        internalDueDate: "2026-08-10",
      }),
    ).rejects.toEqual(
      new ProjectTaskServiceError(
        "VALIDATION_ERROR",
        "El inicio planificado no puede ser posterior a la fecha límite.",
      ),
    );
    expect(store.create).not.toHaveBeenCalled();
  });

  test("rejects creating a task deadline without a planned start", async () => {
    const store = createStore();
    const service = createProjectTaskService(store);

    await expect(
      service.create(actor, "project-1", {
        title: "Preparar escrito",
        stageId: "stage-1",
        internalDueDate: "2026-08-10",
      }),
    ).rejects.toEqual(
      new ProjectTaskServiceError(
        "VALIDATION_ERROR",
        "Selecciona un inicio planificado para usar una fecha límite.",
      ),
    );
    expect(store.create).not.toHaveBeenCalled();
  });

  test("rejects explicitly clearing a task start while retaining a deadline", async () => {
    const store = createStore();
    const service = createProjectTaskService(store);

    await expect(
      service.update(actor, "project-1", "task-1", {
        plannedStartDate: null,
        internalDueDate: "2026-08-10",
      }),
    ).rejects.toEqual(
      new ProjectTaskServiceError(
        "VALIDATION_ERROR",
        "Selecciona un inicio planificado para usar una fecha límite.",
      ),
    );
    expect(store.update).not.toHaveBeenCalled();
  });

  test("returns the tenant-safe project task schedule", async () => {
    const store = createStore();
    const service = createProjectTaskService(store);

    await expect(service.schedule(actor, "project-1")).resolves.toMatchObject({
      project: {
        startDate: "2026-08-06",
        timeZone: "America/Lima",
      },
      stages: [],
    });
    expect(store.schedule).toHaveBeenCalledWith("org-1", "project-1");
  });

  test("uses not found when the project schedule is unavailable", async () => {
    const store = createStore({
      schedule: vi.fn().mockResolvedValue({
        projectExists: false,
        schedule: null,
      }),
    });
    const service = createProjectTaskService(store);

    await expect(
      service.schedule(actor, "project-other"),
    ).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  test("rejects duplicate responsible members before persistence", async () => {
    const store = createStore();
    const service = createProjectTaskService(store);

    await expect(
      service.replaceResponsibles(actor, "project-1", "task-1", [
        "user-2",
        "user-2",
      ]),
    ).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
      message: "No repitas encargados en una tarea.",
    });
    expect(store.replaceResponsibles).not.toHaveBeenCalled();
  });

  test("passes zero or several distinct responsibles to persistence", async () => {
    const store = createStore();
    const service = createProjectTaskService(store);

    await service.replaceResponsibles(actor, "project-1", "task-1", []);
    await service.replaceResponsibles(actor, "project-1", "task-1", [
      "user-2",
      "user-3",
    ]);

    expect(store.replaceResponsibles).toHaveBeenNthCalledWith(1, {
      actor: activeMember,
      projectId: "project-1",
      taskId: "task-1",
      responsibleUserIds: [],
    });
    expect(store.replaceResponsibles).toHaveBeenNthCalledWith(2, {
      actor: activeMember,
      projectId: "project-1",
      taskId: "task-1",
      responsibleUserIds: ["user-2", "user-3"],
    });
  });

  test("describes invalid task assignees as encargados", async () => {
    const store = createStore({
      replaceResponsibles: vi
        .fn()
        .mockResolvedValue({ status: "invalid_responsibles" }),
    });
    const service = createProjectTaskService(store);

    await expect(
      service.replaceResponsibles(actor, "project-1", "task-1", ["user-2"]),
    ).rejects.toMatchObject({
      code: "CONFLICT",
      message: "Los encargados deben pertenecer al equipo actual del proyecto.",
    });
  });

  test.each([
    ["create", "not_found", "NOT_FOUND"],
    ["create", "invalid_dates", "VALIDATION_ERROR"],
    ["update", "conflict", "CONFLICT"],
    ["replaceResponsibles", "invalid_responsibles", "CONFLICT"],
    ["archive", "conflict", "CONFLICT"],
    ["restore", "conflict", "CONFLICT"],
    ["create", "project_archived", "PROJECT_ARCHIVED"],
    ["update", "project_archived", "PROJECT_ARCHIVED"],
    ["replaceResponsibles", "project_archived", "PROJECT_ARCHIVED"],
    ["archive", "project_archived", "PROJECT_ARCHIVED"],
    ["restore", "project_archived", "PROJECT_ARCHIVED"],
  ] as const)(
    "maps %s persistence result %s to %s",
    async (operation, status, code) => {
      const store = createStore({
        [operation]: vi.fn().mockResolvedValue({ status }),
      });
      const service = createProjectTaskService(store);

      const action =
        operation === "create"
          ? service.create(actor, "project-1", {
              title: "Revisar antecedentes",
              stageId: "stage-1",
              responsibleUserIds: [],
            })
          : operation === "update"
            ? service.update(actor, "project-1", "task-1", {
                status: "completed",
              })
            : operation === "replaceResponsibles"
              ? service.replaceResponsibles(actor, "project-1", "task-1", [
                  "user-2",
                ])
              : service[operation](actor, "project-1", "task-1");

      await expect(action).rejects.toMatchObject({ code });
    },
  );

  test("uses tenant-safe not found when the project cannot be listed", async () => {
    const store = createStore({
      list: vi.fn().mockResolvedValue({
        projectExists: false,
        tasks: [],
        total: 0,
      }),
    });
    const service = createProjectTaskService(store);

    await expect(
      service.list(actor, "project-other", { view: "archived" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});
