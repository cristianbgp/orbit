import { describe, expect, test, vi } from "vitest";

import { createApp } from "../src/app";
import { SearchServiceError } from "../src/search/search-service";
import type { SearchService } from "../src/search/search-types";
import type { AuthService, AuthSession } from "../src/auth/types";
import { testClientService } from "./support/client-service";
import { testDashboardService } from "./support/dashboard-service";
import { testIdentityService } from "./support/identity-service";
import { testMyWorkService } from "./support/my-work-service";
import { testProjectCollaborationService } from "./support/project-collaboration-service";
import { testProjectEventService } from "./support/project-event-service";
import { testProjectService } from "./support/project-service";
import { testProjectStageService } from "./support/project-stage-service";
import { testProjectTaskService } from "./support/project-task-service";
import { testTeamInvitationService } from "./support/team-invitation-service";
import { testFeatureFlagService } from "./support/feature-flag-service";
import { testAccountRecoveryService } from "./support/account-recovery-service";

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
  user: { id: "user-1", name: "Ana", email: "ana@orbit.test" },
  session: { id: "session-1", activeOrganizationId: "org-1" },
};

const groupedResult = {
  cases: [
    {
      id: "case-1",
      identification: "Fiscalización Andina",
      status: "in_progress" as const,
      type: "administrative" as const,
      client: { id: "client-1", name: "Andina S.A." },
    },
  ],
  projects: [
    {
      id: "project-1",
      name: "Apelación Andina",
      status: "active" as const,
      client: { id: "client-1", name: "Andina S.A." },
    },
  ],
  tasks: [
    {
      id: "task-1",
      title: "Preparar apelación",
      status: "in_progress" as const,
      project: { id: "project-1", name: "Apelación Andina" },
      client: { id: "client-1", name: "Andina S.A." },
      stage: { id: "stage-1", name: "Redacción" },
    },
  ],
  clients: [
    {
      id: "client-1",
      name: "Andina S.A.",
      type: "company" as const,
      documentNumber: "20123456789",
    },
  ],
  members: [
    {
      userId: "user-2",
      alias: "LP",
      name: "Luis Paz",
      email: "luis@orbit.test",
      role: "member",
    },
  ],
};

function createSearchStub(
  implementation: SearchService["search"] = vi
    .fn()
    .mockResolvedValue(groupedResult),
): SearchService {
  return { search: implementation };
}

function createSearchApp(
  search = createSearchStub(),
  auth: AuthService = createAuthStub(activeSession),
) {
  return createApp({
    auth,
    accountRecovery: testAccountRecoveryService,
    featureFlags: testFeatureFlagService,
    search,
    clients: testClientService,
    dashboard: testDashboardService,
    identity: testIdentityService,
    myWork: testMyWorkService,
    projects: testProjectService,
    projectEvents: testProjectEventService,
    projectStages: testProjectStageService,
    projectCollaboration: testProjectCollaborationService,
    projectTasks: testProjectTaskService,
    teamInvitations: testTeamInvitationService,
  });
}

describe("global search API", () => {
  test("rejects anonymous access", async () => {
    const response = await createSearchApp(
      createSearchStub(),
      createAuthStub(null),
    ).request("/api/search?q=apelación");

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({
      error: { code: "UNAUTHORIZED", message: "Autenticación requerida." },
    });
  });

  test("requires an active organization", async () => {
    const response = await createSearchApp(
      createSearchStub(),
      createAuthStub({
        ...activeSession,
        session: { ...activeSession.session, activeOrganizationId: null },
      }),
    ).request("/api/search?q=apelación");

    expect(response.status).toBe(409);
  });

  test("returns grouped results with the default limit", async () => {
    const search = createSearchStub();
    const response = await createSearchApp(search).request(
      "/api/search?q=%20apelación%20",
    );

    expect(response.status).toBe(200);
    expect(search.search).toHaveBeenCalledWith(
      { userId: "user-1", organizationId: "org-1" },
      { q: "apelación", limit: 5 },
    );
    expect(await response.json()).toEqual(groupedResult);
  });

  test("accepts an explicit per-group limit", async () => {
    const search = createSearchStub();
    const response = await createSearchApp(search).request(
      "/api/search?q=apelación&limit=3",
    );

    expect(response.status).toBe(200);
    expect(search.search).toHaveBeenCalledWith(
      { userId: "user-1", organizationId: "org-1" },
      { q: "apelación", limit: 3 },
    );
  });

  test.each([
    "/api/search",
    "/api/search?q=a",
    `/api/search?q=${"a".repeat(161)}`,
    "/api/search?q=apelación&limit=0",
    "/api/search?q=apelación&limit=11",
  ])("rejects invalid input in %s", async (path) => {
    const search = createSearchStub();
    const response = await createSearchApp(search).request(path);

    expect(response.status).toBe(400);
    expect(search.search).not.toHaveBeenCalled();
  });

  test("maps a missing studio membership to forbidden", async () => {
    const search = createSearchStub(
      vi
        .fn()
        .mockRejectedValue(
          new SearchServiceError(
            "FORBIDDEN",
            "No tienes acceso a este estudio.",
          ),
        ),
    );
    const response = await createSearchApp(search).request(
      "/api/search?q=apelación",
    );

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({
      error: {
        code: "FORBIDDEN",
        message: "No tienes acceso a este estudio.",
      },
    });
  });
});
