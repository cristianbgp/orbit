import { describe, expect, test, vi } from "vitest";

import { createTestApp as createApp } from "./support/app";
import type { AuthService, AuthSession } from "../src/auth/types";
import {
  ProjectStageServiceError,
  type ProjectStageService,
} from "../src/project-stages/project-stage-service";
import { testClientService } from "./support/client-service";
import { testProjectService } from "./support/project-service";
import { testProjectCollaborationService } from "./support/project-collaboration-service";
import { testTeamInvitationService } from "./support/team-invitation-service";

const now = new Date("2026-08-06T10:00:00.000Z");
const stage = {
  id: "stage-1",
  organizationId: "org-1",
  projectId: "project-1",
  name: "Investigación",
  description: "Reunir fundamentos.",
  position: 0,
  createdAt: now,
  updatedAt: now,
};

const activeSession: AuthSession = {
  user: { id: "user-1", name: "Cristian", email: "user@orbit.pe" },
  session: { id: "session-1", activeOrganizationId: "org-1" },
};
const actor = { userId: "user-1", organizationId: "org-1" };

function createAuthStub(session: AuthSession | null): AuthService {
  return {
    handler: async () => new Response(null, { status: 404 }),
    getSession: async () => session,
  };
}

function createStageServiceStub(
  overrides: Partial<
    Record<keyof ProjectStageService, ReturnType<typeof vi.fn>>
  > = {},
) {
  return {
    list: vi.fn().mockResolvedValue([stage]),
    create: vi.fn().mockResolvedValue(stage),
    update: vi.fn().mockResolvedValue(stage),
    reorder: vi.fn().mockResolvedValue([stage]),
    remove: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function createStageApp(
  projectStages = createStageServiceStub(),
  auth = createAuthStub(activeSession),
) {
  return createApp({
    auth,
    clients: testClientService,
    projects: testProjectService,
    projectStages: projectStages as ProjectStageService,
    projectCollaboration: testProjectCollaborationService,
    teamInvitations: testTeamInvitationService,
  });
}

describe("project stage API", () => {
  test("returns the shared archived-project conflict for stage writes", async () => {
    const projectStages = createStageServiceStub({
      create: vi
        .fn()
        .mockRejectedValue(
          new ProjectStageServiceError(
            "PROJECT_ARCHIVED",
            "El proyecto está archivado. Restáuralo para realizar cambios.",
          ),
        ),
    });
    const response = await createStageApp(projectStages).request(
      "/api/projects/project-1/stages",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Audiencia" }),
      },
    );

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      error: {
        code: "PROJECT_ARCHIVED",
        message:
          "El proyecto está archivado. Restáuralo para realizar cambios.",
      },
    });
  });

  test("lists serialized project stages", async () => {
    const projectStages = createStageServiceStub();
    const response = await createStageApp(projectStages).request(
      "/api/projects/project-1/stages",
    );

    expect(response.status).toBe(200);
    expect(projectStages.list).toHaveBeenCalledWith(actor, "project-1");
    expect(await response.json()).toEqual({
      stages: [
        {
          id: "stage-1",
          name: "Investigación",
          description: "Reunir fundamentos.",
          position: 0,
          createdAt: now.toISOString(),
          updatedAt: now.toISOString(),
        },
      ],
    });
  });

  test("creates a manual stage", async () => {
    const projectStages = createStageServiceStub();
    const response = await createStageApp(projectStages).request(
      "/api/projects/project-1/stages",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Audiencia", description: "Preparar" }),
      },
    );

    expect(response.status).toBe(201);
    expect(projectStages.create).toHaveBeenCalledWith(actor, "project-1", {
      name: "Audiencia",
      description: "Preparar",
    });
  });

  test("updates one stage", async () => {
    const projectStages = createStageServiceStub();
    const response = await createStageApp(projectStages).request(
      "/api/projects/project-1/stages/stage-1",
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Investigación jurídica" }),
      },
    );

    expect(response.status).toBe(200);
    expect(projectStages.update).toHaveBeenCalledWith(
      actor,
      "project-1",
      "stage-1",
      { name: "Investigación jurídica" },
    );
  });

  test("reorders the complete stage set", async () => {
    const projectStages = createStageServiceStub();
    const response = await createStageApp(projectStages).request(
      "/api/projects/project-1/stages/order",
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stageIds: ["stage-2", "stage-1"] }),
      },
    );

    expect(response.status).toBe(200);
    expect(projectStages.reorder).toHaveBeenCalledWith(actor, "project-1", {
      stageIds: ["stage-2", "stage-1"],
    });
  });

  test("deletes one empty stage", async () => {
    const projectStages = createStageServiceStub();
    const response = await createStageApp(projectStages).request(
      "/api/projects/project-1/stages/stage-1",
      { method: "DELETE" },
    );

    expect(response.status).toBe(204);
    expect(await response.text()).toBe("");
    expect(projectStages.remove).toHaveBeenCalledWith(
      actor,
      "project-1",
      "stage-1",
    );
  });

  test.each([
    ["POST", "/api/projects/project-1/stages", { name: "" }],
    ["POST", "/api/projects/project-1/stages", { name: "x".repeat(161) }],
    [
      "POST",
      "/api/projects/project-1/stages",
      { name: "Válida", description: "x".repeat(2_001) },
    ],
    ["PATCH", "/api/projects/project-1/stages/stage-1", {}],
    [
      "PUT",
      "/api/projects/project-1/stages/order",
      { stageIds: ["stage-1", "stage-1"] },
    ],
  ])("rejects invalid %s input", async (method, path, body) => {
    const projectStages = createStageServiceStub();
    const response = await createStageApp(projectStages).request(path, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    expect(response.status).toBe(400);
  });

  test.each([
    ["FORBIDDEN", "No puedes modificar la estructura de este proyecto.", 403],
    ["NOT_FOUND", "Etapa no encontrada.", 404],
    ["INVALID_ORDER", "El orden de las etapas ya no está actualizado.", 400],
  ] as const)("maps %s service errors", async (code, message, status) => {
    const projectStages = createStageServiceStub({
      create: vi
        .fn()
        .mockRejectedValue(new ProjectStageServiceError(code, message)),
    });
    const response = await createStageApp(projectStages).request(
      "/api/projects/project-1/stages",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Audiencia" }),
      },
    );

    expect(response.status).toBe(status);
    expect(await response.json()).toEqual({ error: { code, message } });
  });

  test("reuses authentication and active organization boundaries", async () => {
    const anonymous = await createStageApp(
      createStageServiceStub(),
      createAuthStub(null),
    ).request("/api/projects/project-1/stages");
    const noOrganization = await createStageApp(
      createStageServiceStub(),
      createAuthStub({
        ...activeSession,
        session: { ...activeSession.session, activeOrganizationId: null },
      }),
    ).request("/api/projects/project-1/stages");

    expect(anonymous.status).toBe(401);
    expect(noOrganization.status).toBe(409);
  });
});
