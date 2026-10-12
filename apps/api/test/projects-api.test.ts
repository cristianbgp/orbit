import { describe, expect, test, vi } from "vitest";

import { createTestApp as createApp } from "./support/app";
import { ProjectServiceError } from "../src/projects/project-service";
import type { AuthService, AuthSession } from "../src/auth/types";
import { testClientService } from "./support/client-service";
import { testProjectStageService } from "./support/project-stage-service";
import { testTeamInvitationService } from "./support/team-invitation-service";
import { testProjectCollaborationService } from "./support/project-collaboration-service";

const project = {
  id: "project-1",
  organizationId: "org-1",
  clientId: "client-1",
  client: { id: "client-1", name: "Construcciones del Sur S.A." },
  name: "Recurso de apelación",
  type: "written_submission" as const,
  status: "draft" as const,
  startDate: "2026-08-06",
  endDate: "2026-08-14",
  internalReference: null,
  description: null,
  archivedAt: null,
  createdAt: new Date("2026-08-06T10:00:00.000Z"),
  updatedAt: new Date("2026-08-06T10:00:00.000Z"),
};

function createAuthStub(
  session:
    | (AuthSession & {
        session: AuthSession["session"] & {
          activeOrganizationId: string | null;
        };
      })
    | null,
): AuthService {
  return {
    handler: async () => new Response(null, { status: 404 }),
    getSession: async () => session,
  };
}

const activeSession = {
  user: { id: "user-1", name: "Cristian", email: "user@orbit.pe" },
  session: { id: "session-1", activeOrganizationId: "org-1" },
};

function createProjectServiceStub(
  overrides: Record<string, ReturnType<typeof vi.fn>> = {},
) {
  return {
    list: vi.fn().mockResolvedValue({
      projects: [],
      pagination: { page: 1, pageSize: 25, total: 0, totalPages: 0 },
    }),
    listGroupedByClient: vi.fn().mockResolvedValue({
      groups: [],
      pagination: { page: 1, pageSize: 10, total: 0, totalPages: 0 },
      projectTotal: 0,
    }),
    get: vi.fn().mockResolvedValue(project),
    create: vi.fn().mockResolvedValue(project),
    update: vi.fn().mockResolvedValue(project),
    archive: vi.fn().mockResolvedValue(project),
    restore: vi.fn().mockResolvedValue(project),
    ...overrides,
  };
}

function createProjectApp(
  projects = createProjectServiceStub(),
  auth: AuthService = createAuthStub(activeSession),
) {
  return createApp({
    auth,
    clients: testClientService,
    projects,
    projectStages: testProjectStageService,
    teamInvitations: testTeamInvitationService,
    projectCollaboration: testProjectCollaborationService,
  });
}

describe("project API", () => {
  test("rejects anonymous access", async () => {
    const response = await createProjectApp(
      createProjectServiceStub(),
      createAuthStub(null),
    ).request("/api/projects");

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({
      error: { code: "UNAUTHORIZED", message: "Autenticación requerida." },
    });
  });

  test("requires an active organization", async () => {
    const response = await createProjectApp(
      createProjectServiceStub(),
      createAuthStub({
        ...activeSession,
        session: { ...activeSession.session, activeOrganizationId: null },
      }),
    ).request("/api/projects");

    expect(response.status).toBe(409);
  });

  test("maps a missing membership to forbidden", async () => {
    const projects = createProjectServiceStub({
      list: vi
        .fn()
        .mockRejectedValue(
          new ProjectServiceError(
            "FORBIDDEN",
            "No tienes acceso a este estudio.",
          ),
        ),
    });

    const response = await createProjectApp(projects).request("/api/projects");

    expect(response.status).toBe(403);
  });

  test("lists projects with normalized filters and default pagination", async () => {
    const projects = createProjectServiceStub({
      list: vi.fn().mockResolvedValue({
        projects: [project],
        pagination: { page: 1, pageSize: 25, total: 1, totalPages: 1 },
      }),
    });

    const response = await createProjectApp(projects).request(
      "/api/projects?search=Recurso&type=written_submission&type=consultation&status=completed&client=client-1&member=user-1&member=user-2&view=archived",
    );

    expect(response.status).toBe(200);
    expect(projects.list).toHaveBeenCalledWith(
      { userId: "user-1", organizationId: "org-1" },
      {
        search: "Recurso",
        type: ["written_submission", "consultation"],
        status: ["completed"],
        client: ["client-1"],
        member: ["user-1", "user-2"],
        view: "archived",
        page: 1,
        pageSize: 25,
      },
    );
    expect(await response.json()).toEqual({
      projects: [
        {
          id: "project-1",
          client: project.client,
          name: "Recurso de apelación",
          type: "written_submission",
          status: "draft",
          startDate: "2026-08-06",
          endDate: "2026-08-14",
          internalReference: null,
          description: null,
          archivedAt: null,
          createdAt: "2026-08-06T10:00:00.000Z",
          updatedAt: "2026-08-06T10:00:00.000Z",
        },
      ],
      pagination: { page: 1, pageSize: 25, total: 1, totalPages: 1 },
    });
  });

  test("accepts explicit pagination", async () => {
    const projects = createProjectServiceStub({
      list: vi.fn().mockResolvedValue({
        projects: [],
        pagination: { page: 3, pageSize: 10, total: 52, totalPages: 6 },
      }),
    });

    const response = await createProjectApp(projects).request(
      "/api/projects?page=3&pageSize=10",
    );

    expect(response.status).toBe(200);
    expect(projects.list).toHaveBeenCalledWith(
      { userId: "user-1", organizationId: "org-1" },
      { page: 3, pageSize: 10 },
    );
  });

  test("lists complete project groups paginated by client", async () => {
    const projects = createProjectServiceStub({
      listGroupedByClient: vi.fn().mockResolvedValue({
        groups: [{ client: project.client, projects: [project] }],
        pagination: { page: 1, pageSize: 10, total: 1, totalPages: 1 },
        projectTotal: 1,
      }),
    });

    const response = await createProjectApp(projects).request(
      "/api/projects/grouped-by-client?search=Recurso&type=consultation&client=client-1&member=user-1&view=archived",
    );

    expect(response.status).toBe(200);
    expect(projects.listGroupedByClient).toHaveBeenCalledWith(
      { userId: "user-1", organizationId: "org-1" },
      {
        search: "Recurso",
        type: ["consultation"],
        client: ["client-1"],
        member: ["user-1"],
        view: "archived",
        page: 1,
        pageSize: 10,
      },
    );
    expect(await response.json()).toMatchObject({
      groups: [
        {
          client: project.client,
          projects: [{ id: "project-1", archivedAt: null }],
        },
      ],
      pagination: { page: 1, pageSize: 10, total: 1, totalPages: 1 },
      projectTotal: 1,
    });
  });

  test.each([
    "/api/projects?page=0",
    "/api/projects?pageSize=0",
    "/api/projects?pageSize=101",
    "/api/projects?type=unknown",
    "/api/projects?status=archived",
    "/api/projects?status=cancelled",
    "/api/projects?view=cancelled",
    "/api/projects?view=deleted",
  ])("rejects invalid list input in %s", async (path) => {
    const projects = createProjectServiceStub();

    const response = await createProjectApp(projects).request(path);

    expect(response.status).toBe(400);
    expect(projects.list).not.toHaveBeenCalled();
  });

  test.each([
    "/api/projects/grouped-by-client?page=0",
    "/api/projects/grouped-by-client?pageSize=0",
    "/api/projects/grouped-by-client?pageSize=101",
    "/api/projects/grouped-by-client?status=archived",
    "/api/projects/grouped-by-client?status=cancelled",
    "/api/projects/grouped-by-client?view=cancelled",
  ])("rejects invalid grouped-list input in %s", async (path) => {
    const projects = createProjectServiceStub();

    const response = await createProjectApp(projects).request(path);

    expect(response.status).toBe(400);
    expect(projects.listGroupedByClient).not.toHaveBeenCalled();
  });

  test("creates a draft project with valid date order", async () => {
    const projects = createProjectServiceStub();
    const input = {
      name: "Recurso de apelación",
      clientId: "client-1",
      type: "written_submission",
      startDate: "2026-08-06",
      endDate: "2026-08-14",
    };

    const response = await createProjectApp(projects).request("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });

    expect(response.status).toBe(201);
    expect(projects.create).toHaveBeenCalledWith(
      { userId: "user-1", organizationId: "org-1" },
      { ...input, status: "draft" },
    );
  });

  test("rejects invalid date order before project creation", async () => {
    const projects = createProjectServiceStub();

    const response = await createProjectApp(projects).request("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Recurso de apelación",
        clientId: "client-1",
        type: "written_submission",
        startDate: "2026-08-15",
        endDate: "2026-08-14",
      }),
    });

    expect(response.status).toBe(400);
    expect(projects.create).not.toHaveBeenCalled();
  });

  test("rejects singular and plural initial legal events together", async () => {
    const projects = createProjectServiceStub();
    const response = await createProjectApp(projects).request("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Recurso de apelación",
        clientId: "client-1",
        type: "written_submission",
        startDate: "2026-08-06",
        endDate: "2026-08-14",
        initialLegalEvent: { date: "2026-08-20" },
        initialLegalEvents: [{ date: "2026-08-21" }],
      }),
    });

    expect(response.status).toBe(400);
    expect(projects.create).not.toHaveBeenCalled();
  });

  test("rejects more than 25 initial legal events", async () => {
    const projects = createProjectServiceStub();
    const response = await createProjectApp(projects).request("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Recurso de apelación",
        clientId: "client-1",
        type: "written_submission",
        startDate: "2026-08-06",
        endDate: "2026-08-14",
        initialLegalEvents: Array.from({ length: 26 }, (_, index) => ({
          title: `Fecha legal ${index + 1}`,
          date: "2026-08-20",
        })),
      }),
    });

    expect(response.status).toBe(400);
    expect(projects.create).not.toHaveBeenCalled();
  });

  test("rejects duplicate members in the initial project team", async () => {
    const projects = createProjectServiceStub();
    const response = await createProjectApp(projects).request("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Recurso de apelación",
        clientId: "client-1",
        type: "written_submission",
        startDate: "2026-08-06",
        endDate: "2026-08-14",
        initialAssignments: [
          { userId: "user-2", responsibility: "member" },
          { userId: "user-2", responsibility: "responsible" },
        ],
      }),
    });

    expect(response.status).toBe(400);
    expect(projects.create).not.toHaveBeenCalled();
  });

  test("maps an unavailable initial member to a validation error", async () => {
    const projects = createProjectServiceStub({
      create: vi
        .fn()
        .mockRejectedValue(
          new ProjectServiceError(
            "MEMBER_NOT_FOUND",
            "Uno o más integrantes ya no están disponibles en el estudio.",
          ),
        ),
    });
    const response = await createProjectApp(projects).request("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Recurso de apelación",
        clientId: "client-1",
        type: "written_submission",
        startDate: "2026-08-06",
        endDate: "2026-08-14",
        initialAssignments: [
          { userId: "missing-user", responsibility: "member" },
        ],
      }),
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: {
        code: "VALIDATION_ERROR",
        message: "Uno o más integrantes ya no están disponibles en el estudio.",
      },
    });
  });

  test("maps an unavailable client without disclosing tenant data", async () => {
    const projects = createProjectServiceStub({
      create: vi
        .fn()
        .mockRejectedValue(
          new ProjectServiceError("CLIENT_NOT_FOUND", "Cliente no disponible."),
        ),
    });

    const response = await createProjectApp(projects).request("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Recurso de apelación",
        clientId: "client-from-another-org",
        type: "written_submission",
        startDate: "2026-08-06",
        endDate: "2026-08-14",
      }),
    });

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      error: { code: "NOT_FOUND", message: "Cliente no disponible." },
    });
  });

  test("loads a project without exposing tenant implementation fields", async () => {
    const response = await createProjectApp().request(
      "/api/projects/project-1",
    );
    const payload = (await response.json()) as {
      project: Record<string, unknown>;
    };

    expect(response.status).toBe(200);
    expect(payload.project.id).toBe("project-1");
    expect(payload.project).not.toHaveProperty("organizationId");
    expect(payload.project).not.toHaveProperty("clientId");
    expect(payload.project.client).toEqual(project.client);
  });

  test("updates one project", async () => {
    const projects = createProjectServiceStub();

    const response = await createProjectApp(projects).request(
      "/api/projects/project-1",
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "active" }),
      },
    );

    expect(response.status).toBe(200);
    expect(projects.update).toHaveBeenCalledWith(
      { userId: "user-1", organizationId: "org-1" },
      "project-1",
      { status: "active" },
    );
  });

  test("rejects cancelled as a project update status", async () => {
    const projects = createProjectServiceStub();

    const response = await createProjectApp(projects).request(
      "/api/projects/project-1",
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "cancelled" }),
      },
    );

    expect(response.status).toBe(400);
    expect(projects.update).not.toHaveBeenCalled();
  });

  test("preserves the specific project start conflict message", async () => {
    const message =
      "El inicio del proyecto no puede ser posterior a la fecha de un evento.";
    const projects = createProjectServiceStub({
      update: vi
        .fn()
        .mockRejectedValue(new ProjectServiceError("INVALID_DATES", message)),
    });

    const response = await createProjectApp(projects).request(
      "/api/projects/project-1",
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ startDate: "2026-08-20" }),
      },
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: { code: "VALIDATION_ERROR", message },
    });
  });

  test("archives and restores one project", async () => {
    const archived = {
      ...project,
      archivedAt: new Date("2026-08-10T12:00:00.000Z"),
    };
    const projects = createProjectServiceStub({
      archive: vi.fn().mockResolvedValue(archived),
      restore: vi.fn().mockResolvedValue(project),
    });
    const app = createProjectApp(projects);

    const archiveResponse = await app.request(
      "/api/projects/project-1/archive",
      { method: "POST" },
    );
    expect(archiveResponse.status).toBe(200);
    expect(projects.archive).toHaveBeenCalledWith(
      { userId: "user-1", organizationId: "org-1" },
      "project-1",
    );
    expect(await archiveResponse.json()).toMatchObject({
      project: { id: "project-1", archivedAt: "2026-08-10T12:00:00.000Z" },
    });

    const restoreResponse = await app.request(
      "/api/projects/project-1/restore",
      { method: "POST" },
    );
    expect(restoreResponse.status).toBe(200);
    expect(projects.restore).toHaveBeenCalledWith(
      { userId: "user-1", organizationId: "org-1" },
      "project-1",
    );
    expect(await restoreResponse.json()).toMatchObject({
      project: { id: "project-1", archivedAt: null },
    });
  });

  test("maps archived writes and repeated lifecycle actions to exact conflicts", async () => {
    const archivedError = new ProjectServiceError(
      "PROJECT_ARCHIVED",
      "El proyecto está archivado. Restáuralo para realizar cambios.",
    );
    const archiveConflict = new ProjectServiceError(
      "PROJECT_ARCHIVE_CONFLICT",
      "El proyecto ya está archivado.",
    );
    const projects = createProjectServiceStub({
      update: vi.fn().mockRejectedValue(archivedError),
      archive: vi.fn().mockRejectedValue(archiveConflict),
    });
    const app = createProjectApp(projects);

    const updateResponse = await app.request("/api/projects/project-1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "completed" }),
    });
    expect(updateResponse.status).toBe(409);
    expect(await updateResponse.json()).toEqual({
      error: {
        code: "PROJECT_ARCHIVED",
        message:
          "El proyecto está archivado. Restáuralo para realizar cambios.",
      },
    });

    const archiveResponse = await app.request(
      "/api/projects/project-1/archive",
      { method: "POST" },
    );
    expect(archiveResponse.status).toBe(409);
    expect(await archiveResponse.json()).toEqual({
      error: {
        code: "PROJECT_ARCHIVE_CONFLICT",
        message: "El proyecto ya está archivado.",
      },
    });
  });

  test("does not apply create defaults to omitted update fields", async () => {
    const projects = createProjectServiceStub();

    const response = await createProjectApp(projects).request(
      "/api/projects/project-1",
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Apelación actualizada" }),
      },
    );

    expect(response.status).toBe(200);
    expect(projects.update).toHaveBeenCalledWith(
      { userId: "user-1", organizationId: "org-1" },
      "project-1",
      { name: "Apelación actualizada" },
    );
  });

  test("returns not found for a project outside the tenant", async () => {
    const projects = createProjectServiceStub({
      get: vi
        .fn()
        .mockRejectedValue(
          new ProjectServiceError("NOT_FOUND", "Proyecto no encontrado."),
        ),
    });

    const response = await createProjectApp(projects).request(
      "/api/projects/project-from-another-org",
    );

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      error: { code: "NOT_FOUND", message: "Proyecto no encontrado." },
    });
  });
});
