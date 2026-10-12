import { describe, expect, test, vi } from "vitest";

import { createApp } from "../src/app";
import type { AuthService, AuthSession } from "../src/auth/types";
import {
  ProjectTaskServiceError,
  type ProjectTaskService,
} from "../src/project-tasks/project-task-service";
import { testClientService } from "./support/client-service";
import { testProjectCollaborationService } from "./support/project-collaboration-service";
import { testProjectService } from "./support/project-service";
import { testProjectStageService } from "./support/project-stage-service";
import { testTeamInvitationService } from "./support/team-invitation-service";
import { testIdentityService } from "./support/identity-service";
import { testDashboardService } from "./support/dashboard-service";
import { testMyWorkService } from "./support/my-work-service";
import { testProjectEventService } from "./support/project-event-service";
import { testSearchService } from "./support/search-service";
import { testFeatureFlagService } from "./support/feature-flag-service";
import { testAccountRecoveryService } from "./support/account-recovery-service";

const now = new Date("2026-08-06T20:00:00.000Z");
const actor = { userId: "user-1", organizationId: "org-1" };
const task = {
  id: "task-1",
  organizationId: "org-1",
  projectId: "project-1",
  stageId: "stage-1",
  stageName: "Investigación",
  stagePosition: 0,
  title: "Revisar antecedentes",
  description: null,
  status: "pending" as const,
  internalDueDate: null,
  position: 0,
  archivedAt: null,
  responsibles: [
    {
      assignmentId: "task-assignment-1",
      userId: "user-2",
      userName: "Luis Ramos",
      userEmail: "luis@orbit.pe",
      userAlias: "CGP",
      activeStudioMember: true,
      assignedAt: now,
    },
  ],
  createdAt: now,
  updatedAt: now,
};
const activeSession: AuthSession = {
  user: { id: "user-1", name: "Ana Torres", email: "ana@orbit.pe" },
  session: { id: "session-1", activeOrganizationId: "org-1" },
};

function authStub(session: AuthSession | null = activeSession): AuthService {
  return {
    handler: async () => new Response(null, { status: 404 }),
    getSession: async () => session,
  };
}

function taskServiceStub(
  overrides: Partial<
    Record<keyof ProjectTaskService, ReturnType<typeof vi.fn>>
  > = {},
): ProjectTaskService {
  return {
    calendar: vi.fn().mockResolvedValue({
      tasks: [
        {
          id: "task-1",
          title: "Revisar antecedentes",
          status: "pending",
          plannedStartDate: "2026-08-10",
          internalDueDate: "2026-08-14",
          position: 0,
          project: {
            id: "project-1",
            name: "Apelación Constructora",
            startDate: "2026-08-06",
            client: { id: "client-1", name: "Constructora del Sur" },
          },
          stage: { id: "stage-1", name: "Investigación", position: 0 },
          responsibles: task.responsibles,
        },
      ],
      markers: [
        {
          projectId: "project-1",
          projectName: "Apelación Constructora",
          clientName: "Constructora del Sur",
          kind: "project_event",
          date: "2026-08-17",
          eventId: "event-1",
          eventTitle: "Audiencia",
          eventType: "legal",
        },
      ],
      undatedTaskCount: 2,
      truncated: false,
    }),
    listUndated: vi.fn().mockResolvedValue({
      tasks: [],
      pagination: { page: 1, pageSize: 25, total: 0, totalPages: 0 },
    }),
    list: vi.fn().mockResolvedValue({
      tasks: [task],
      pagination: { page: 1, pageSize: 25, total: 1, totalPages: 1 },
    }),
    get: vi.fn().mockResolvedValue(task),
    create: vi.fn().mockResolvedValue(task),
    update: vi.fn().mockResolvedValue(task),
    replaceResponsibles: vi.fn().mockResolvedValue(task),
    archive: vi.fn().mockResolvedValue({ ...task, archivedAt: now }),
    restore: vi.fn().mockResolvedValue(task),
    ...overrides,
  } as ProjectTaskService;
}

function app(
  projectTasks: ProjectTaskService = taskServiceStub(),
  auth: AuthService = authStub(),
) {
  return createApp({
    auth,
    accountRecovery: testAccountRecoveryService,
    featureFlags: testFeatureFlagService,
    identity: testIdentityService,
    search: testSearchService,
    clients: testClientService,
    projects: testProjectService,
    projectEvents: testProjectEventService,
    projectStages: testProjectStageService,
    projectCollaboration: testProjectCollaborationService,
    projectTasks,
    teamInvitations: testTeamInvitationService,
    dashboard: testDashboardService,
    myWork: testMyWorkService,
  });
}

describe("project tasks API", () => {
  test("lists studio task calendar with repeated multi-select filters", async () => {
    const projectTasks = taskServiceStub();
    const response = await app(projectTasks).request(
      "/api/project-tasks/calendar?from=2026-07-27&to=2026-09-06&projectIds=project-1&projectIds=project-2&responsibleUserIds=user-2&statuses=pending&statuses=blocked&search=apelacion&overdueOnly=false",
    );

    expect(response.status).toBe(200);
    expect(projectTasks.calendar).toHaveBeenCalledWith(actor, {
      from: "2026-07-27",
      to: "2026-09-06",
      projectIds: ["project-1", "project-2"],
      responsibleUserIds: ["user-2"],
      statuses: ["pending", "blocked"],
      search: "apelacion",
      overdueOnly: false,
    });
    expect(await response.json()).toMatchObject({
      tasks: [{ id: "task-1", project: { id: "project-1" } }],
      markers: [{ kind: "project_event", date: "2026-08-17" }],
      undatedTaskCount: 2,
      truncated: false,
    });
  });

  test("lists paginated undated studio tasks", async () => {
    const projectTasks = taskServiceStub();
    const response = await app(projectTasks).request(
      "/api/project-tasks/undated?page=2&pageSize=10&statuses=pending",
    );

    expect(response.status).toBe(200);
    expect(projectTasks.listUndated).toHaveBeenCalledWith(actor, {
      projectIds: [],
      responsibleUserIds: [],
      statuses: ["pending"],
      overdueOnly: false,
      page: 2,
      pageSize: 10,
    });
  });

  test.each([
    "/api/project-tasks/calendar?from=2026-09-01&to=2026-08-01",
    "/api/project-tasks/calendar?from=2026-08-01&to=2026-09-12",
    "/api/project-tasks/calendar?from=invalid&to=2026-08-31",
    "/api/project-tasks/calendar?from=2026-08-01&to=2026-08-31&statuses=unknown",
  ])("rejects invalid calendar query %s", async (path) => {
    expect((await app().request(path)).status).toBe(400);
  });

  test("returns the shared archived-project conflict for task writes", async () => {
    const projectTasks = taskServiceStub({
      create: vi
        .fn()
        .mockRejectedValue(
          new ProjectTaskServiceError(
            "PROJECT_ARCHIVED",
            "El proyecto está archivado. Restáuralo para realizar cambios.",
          ),
        ),
    });
    const response = await app(projectTasks).request(
      "/api/projects/project-1/tasks",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Tarea", stageId: "stage-1" }),
      },
    );

    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({
      error: { code: "PROJECT_ARCHIVED" },
    });
  });

  test("gets an active task with serialized responsible identity fields", async () => {
    const projectTasks = taskServiceStub();
    const response = await app(projectTasks).request(
      "/api/projects/project-1/tasks/task-1",
    );

    expect(response.status).toBe(200);
    expect(projectTasks.get).toHaveBeenCalledWith(actor, "project-1", "task-1");
    expect(await response.json()).toMatchObject({
      task: {
        id: "task-1",
        responsibles: [
          {
            userId: "user-2",
            userName: "Luis Ramos",
            userEmail: "luis@orbit.pe",
            userAlias: "CGP",
            activeStudioMember: true,
          },
        ],
      },
    });
  });

  test("gets an archived task", async () => {
    const response = await app(
      taskServiceStub({
        get: vi.fn().mockResolvedValue({ ...task, archivedAt: now }),
      }),
    ).request("/api/projects/project-1/tasks/task-archived");

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      task: { archivedAt: now.toISOString() },
    });
  });

  test("maps an unavailable task read to not found", async () => {
    const response = await app(
      taskServiceStub({
        get: vi
          .fn()
          .mockRejectedValue(
            new ProjectTaskServiceError("NOT_FOUND", "Tarea no encontrada."),
          ),
      }),
    ).request("/api/projects/project-1/tasks/missing");

    expect(response.status).toBe(404);
  });

  test("lists active tasks with pagination and serialized task data", async () => {
    const projectTasks = taskServiceStub();
    const response = await app(projectTasks).request(
      "/api/projects/project-1/tasks?view=active&page=1&pageSize=25",
    );

    expect(response.status).toBe(200);
    expect(projectTasks.list).toHaveBeenCalledWith(actor, "project-1", {
      view: "active",
      page: 1,
      pageSize: 25,
    });
    expect(await response.json()).toMatchObject({
      tasks: [
        {
          id: "task-1",
          stage: { id: "stage-1", name: "Investigación", position: 0 },
          status: "pending",
          archivedAt: null,
          responsibles: [
            {
              userAlias: "CGP",
              activeStudioMember: true,
              userName: "Luis Ramos",
              assignedAt: now.toISOString(),
            },
          ],
        },
      ],
    });
  });

  test("creates a task without accepting actor facts", async () => {
    const projectTasks = taskServiceStub();
    const data = {
      title: "Revisar antecedentes",
      stageId: "stage-1",
      responsibleUserIds: ["user-2"],
    };
    const response = await app(projectTasks).request(
      "/api/projects/project-1/tasks",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      },
    );

    expect(response.status).toBe(201);
    expect(projectTasks.create).toHaveBeenCalledWith(actor, "project-1", {
      ...data,
      status: "pending",
    });
  });

  test("updates, replaces responsibles, archives, and restores", async () => {
    const projectTasks = taskServiceStub();
    const instance = app(projectTasks);
    const update = await instance.request(
      "/api/projects/project-1/tasks/task-1",
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "completed", internalDueDate: null }),
      },
    );
    const responsibles = await instance.request(
      "/api/projects/project-1/tasks/task-1/responsibles",
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ responsibleUserIds: ["user-2", "user-3"] }),
      },
    );
    const archive = await instance.request(
      "/api/projects/project-1/tasks/task-1/archive",
      {
        method: "POST",
      },
    );
    const restore = await instance.request(
      "/api/projects/project-1/tasks/task-1/restore",
      {
        method: "POST",
      },
    );

    expect([
      update.status,
      responsibles.status,
      archive.status,
      restore.status,
    ]).toEqual([200, 200, 200, 200]);
    expect(projectTasks.update).toHaveBeenCalledWith(
      actor,
      "project-1",
      "task-1",
      {
        status: "completed",
        internalDueDate: null,
      },
    );
    expect(projectTasks.replaceResponsibles).toHaveBeenCalledWith(
      actor,
      "project-1",
      "task-1",
      ["user-2", "user-3"],
    );
    expect(projectTasks.archive).toHaveBeenCalledWith(
      actor,
      "project-1",
      "task-1",
    );
    expect(projectTasks.restore).toHaveBeenCalledWith(
      actor,
      "project-1",
      "task-1",
    );
  });

  test.each([
    ["FORBIDDEN", 403],
    ["NOT_FOUND", 404],
    ["VALIDATION_ERROR", 400],
    ["CONFLICT", 409],
  ] as const)("maps %s task errors", async (code, status) => {
    const response = await app(
      taskServiceStub({
        create: vi
          .fn()
          .mockRejectedValue(
            new ProjectTaskServiceError(code, "No disponible."),
          ),
      }),
    ).request("/api/projects/project-1/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Nueva tarea", stageId: "stage-1" }),
    });

    expect(response.status).toBe(status);
    expect(await response.json()).toEqual({
      error: { code, message: "No disponible." },
    });
  });

  test("validates task input and requires an active session", async () => {
    const invalid = await app().request("/api/projects/project-1/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "x", stageId: "" }),
    });
    const anonymous = await app(taskServiceStub(), authStub(null)).request(
      "/api/projects/project-1/tasks",
    );

    expect(invalid.status).toBe(400);
    expect(anonymous.status).toBe(401);
  });

  test("rejects a task deadline without a planned start at the request contract", async () => {
    const projectTasks = taskServiceStub();
    const response = await app(projectTasks).request(
      "/api/projects/project-1/tasks",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "Preparar escrito",
          stageId: "stage-1",
          internalDueDate: "2026-08-14",
        }),
      },
    );

    expect(response.status).toBe(400);
    expect(projectTasks.create).not.toHaveBeenCalled();
  });
});
