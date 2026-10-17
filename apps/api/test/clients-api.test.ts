import { describe, expect, test, vi } from "vitest";

import { createTestApp as createApp } from "./support/app";
import { ClientServiceError } from "../src/clients/client-service";
import type { AuthService, AuthSession } from "../src/auth/types";
import { testProjectService } from "./support/project-service";
import { testProjectStageService } from "./support/project-stage-service";
import { testTeamInvitationService } from "./support/team-invitation-service";
import { testProjectCollaborationService } from "./support/project-collaboration-service";

const client = {
  id: "client-1",
  organizationId: "org-1",
  type: "company" as const,
  name: "Constructora del Sur S.A.",
  documentType: "RUC",
  documentNumber: "20123456789",
  email: "legal@constructora.pe",
  phone: "+51 999 111 222",
  address: "Av. Principal 123, Lima",
  notes: null,
  createdAt: new Date("2026-08-05T10:00:00.000Z"),
  updatedAt: new Date("2026-08-05T10:00:00.000Z"),
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

function createClientServiceStub(
  overrides: Record<string, ReturnType<typeof vi.fn>> = {},
) {
  return {
    list: vi.fn().mockResolvedValue({
      clients: [],
      pagination: { page: 1, pageSize: 25, total: 0, totalPages: 0 },
    }),
    get: vi.fn().mockResolvedValue(client),
    create: vi.fn().mockResolvedValue(client),
    update: vi.fn().mockResolvedValue(client),
    ...overrides,
  };
}

describe("client API", () => {
  test("rejects anonymous access", async () => {
    const app = createApp({
      auth: createAuthStub(null),
      clients: createClientServiceStub(),
      projects: testProjectService,
      projectStages: testProjectStageService,
      teamInvitations: testTeamInvitationService,
      projectCollaboration: testProjectCollaborationService,
    });

    const response = await app.request("/api/clients");

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({
      error: { code: "UNAUTHORIZED", message: "Autenticación requerida." },
    });
  });

  test("requires an active organization", async () => {
    const app = createApp({
      auth: createAuthStub({
        ...activeSession,
        session: { ...activeSession.session, activeOrganizationId: null },
      }),
      clients: createClientServiceStub(),
      projects: testProjectService,
      projectStages: testProjectStageService,
      teamInvitations: testTeamInvitationService,
      projectCollaboration: testProjectCollaborationService,
    });

    const response = await app.request("/api/clients");

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      error: {
        code: "ORGANIZATION_REQUIRED",
        message: "Selecciona un estudio para continuar.",
      },
    });
  });

  test("rejects a session without membership", async () => {
    const app = createApp({
      auth: createAuthStub(activeSession),
      clients: createClientServiceStub({
        list: vi
          .fn()
          .mockRejectedValue(
            new ClientServiceError(
              "FORBIDDEN",
              "No tienes acceso a este estudio.",
            ),
          ),
      }),
      projects: testProjectService,
      projectStages: testProjectStageService,
      teamInvitations: testTeamInvitationService,
      projectCollaboration: testProjectCollaborationService,
    });

    const response = await app.request("/api/clients");

    expect(response.status).toBe(403);
  });

  test("lists clients using normalized filters and tenant actor", async () => {
    const clients = createClientServiceStub({
      list: vi.fn().mockResolvedValue({
        clients: [client],
        pagination: { page: 1, pageSize: 25, total: 1, totalPages: 1 },
      }),
    });
    const app = createApp({
      auth: createAuthStub(activeSession),
      clients,
      projects: testProjectService,
      projectStages: testProjectStageService,
      teamInvitations: testTeamInvitationService,
      projectCollaboration: testProjectCollaborationService,
    });

    const response = await app.request(
      "/api/clients?search=Constructora&type=company",
    );

    expect(response.status).toBe(200);
    expect(clients.list).toHaveBeenCalledWith(
      { userId: "user-1", organizationId: "org-1" },
      { search: "Constructora", type: "company", page: 1, pageSize: 25 },
    );
    expect(await response.json()).toEqual({
      clients: [
        {
          ...client,
          organizationId: undefined,
          createdAt: "2026-08-05T10:00:00.000Z",
          updatedAt: "2026-08-05T10:00:00.000Z",
        },
      ],
      pagination: { page: 1, pageSize: 25, total: 1, totalPages: 1 },
    });
  });

  test("accepts an explicit client page and page size", async () => {
    const clients = createClientServiceStub({
      list: vi.fn().mockResolvedValue({
        clients: [],
        pagination: { page: 3, pageSize: 10, total: 52, totalPages: 6 },
      }),
    });
    const app = createApp({
      auth: createAuthStub(activeSession),
      clients,
      projects: testProjectService,
      projectStages: testProjectStageService,
      teamInvitations: testTeamInvitationService,
      projectCollaboration: testProjectCollaborationService,
    });

    const response = await app.request("/api/clients?page=3&pageSize=10");

    expect(response.status).toBe(200);
    expect(clients.list).toHaveBeenCalledWith(
      { userId: "user-1", organizationId: "org-1" },
      { page: 3, pageSize: 10 },
    );
    expect(await response.json()).toEqual({
      clients: [],
      pagination: { page: 3, pageSize: 10, total: 52, totalPages: 6 },
    });
  });

  test.each([
    "/api/clients?page=0",
    "/api/clients?pageSize=0",
    "/api/clients?pageSize=101",
  ])("rejects invalid pagination in %s", async (path) => {
    const clients = createClientServiceStub();
    const app = createApp({
      auth: createAuthStub(activeSession),
      clients,
      projects: testProjectService,
      projectStages: testProjectStageService,
      teamInvitations: testTeamInvitationService,
      projectCollaboration: testProjectCollaborationService,
    });

    const response = await app.request(path);

    expect(response.status).toBe(400);
    expect(clients.list).not.toHaveBeenCalled();
  });

  test("preserves metadata for an empty out-of-range page", async () => {
    const clients = createClientServiceStub({
      list: vi.fn().mockResolvedValue({
        clients: [],
        pagination: { page: 8, pageSize: 25, total: 52, totalPages: 3 },
      }),
    });
    const app = createApp({
      auth: createAuthStub(activeSession),
      clients,
      projects: testProjectService,
      projectStages: testProjectStageService,
      teamInvitations: testTeamInvitationService,
      projectCollaboration: testProjectCollaborationService,
    });

    const response = await app.request("/api/clients?page=8");

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      clients: [],
      pagination: { page: 8, pageSize: 25, total: 52, totalPages: 3 },
    });
  });

  test("creates a company client", async () => {
    const clients = createClientServiceStub();
    const app = createApp({
      auth: createAuthStub(activeSession),
      clients,
      projects: testProjectService,
      projectStages: testProjectStageService,
      teamInvitations: testTeamInvitationService,
      projectCollaboration: testProjectCollaborationService,
    });
    const input = {
      type: "company",
      name: "Constructora del Sur S.A.",
      documentType: "RUC",
      documentNumber: "20123456789",
    };

    const response = await app.request("/api/clients", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });

    expect(response.status).toBe(201);
    expect(clients.create).toHaveBeenCalledWith(
      { userId: "user-1", organizationId: "org-1" },
      input,
    );
  });

  test("rejects an invalid person name", async () => {
    const clients = createClientServiceStub();
    const app = createApp({
      auth: createAuthStub(activeSession),
      clients,
      projects: testProjectService,
      projectStages: testProjectStageService,
      teamInvitations: testTeamInvitationService,
      projectCollaboration: testProjectCollaborationService,
    });

    const response = await app.request("/api/clients", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "person", name: "A" }),
    });

    expect(response.status).toBe(400);
    expect(clients.create).not.toHaveBeenCalled();
  });

  test("loads one client without exposing the organization id", async () => {
    const app = createApp({
      auth: createAuthStub(activeSession),
      clients: createClientServiceStub(),
      projects: testProjectService,
      projectStages: testProjectStageService,
      teamInvitations: testTeamInvitationService,
      projectCollaboration: testProjectCollaborationService,
    });

    const response = await app.request("/api/clients/client-1");
    const payload = (await response.json()) as {
      client: Record<string, unknown>;
    };

    expect(response.status).toBe(200);
    expect(payload.client.id).toBe("client-1");
    expect(payload.client).not.toHaveProperty("organizationId");
  });

  test("returns not found for a client outside the tenant boundary", async () => {
    const app = createApp({
      auth: createAuthStub(activeSession),
      clients: createClientServiceStub({
        update: vi
          .fn()
          .mockRejectedValue(
            new ClientServiceError("NOT_FOUND", "Cliente no encontrado."),
          ),
      }),
      projects: testProjectService,
      projectStages: testProjectStageService,
      teamInvitations: testTeamInvitationService,
      projectCollaboration: testProjectCollaborationService,
    });

    const response = await app.request("/api/clients/other-client", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Nombre actualizado" }),
    });

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      error: { code: "NOT_FOUND", message: "Cliente no encontrado." },
    });
  });
});
