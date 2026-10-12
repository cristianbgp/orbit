import { describe, expect, test, vi } from "vitest";

import { createApp } from "../src/app";
import type { AuthService, AuthSession } from "../src/auth/types";
import { FeatureFlagServiceError } from "../src/feature-flags/feature-flag-service";
import type { FeatureFlagService } from "../src/feature-flags/feature-flag-types";
import { testClientService } from "./support/client-service";
import { testDashboardService } from "./support/dashboard-service";
import { testIdentityService } from "./support/identity-service";
import { testMyWorkService } from "./support/my-work-service";
import { testProjectCollaborationService } from "./support/project-collaboration-service";
import { testProjectEventService } from "./support/project-event-service";
import { testProjectService } from "./support/project-service";
import { testProjectStageService } from "./support/project-stage-service";
import { testProjectTaskService } from "./support/project-task-service";
import { testSearchService } from "./support/search-service";
import { testTeamInvitationService } from "./support/team-invitation-service";
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

function createFeatureFlagStub(
  resolveForActor: FeatureFlagService["resolveForActor"] = vi
    .fn()
    .mockResolvedValue({ orbitHelpAssistant: true }),
): FeatureFlagService {
  return {
    resolveForActor,
    isEnabled: vi.fn().mockResolvedValue(false),
    assertEnabled: vi.fn().mockResolvedValue(undefined),
  };
}

function createFeatureFlagApp(
  featureFlags = createFeatureFlagStub(),
  auth: AuthService = createAuthStub(activeSession),
) {
  return createApp({
    auth,
    accountRecovery: testAccountRecoveryService,
    featureFlags,
    clients: testClientService,
    dashboard: testDashboardService,
    identity: testIdentityService,
    myWork: testMyWorkService,
    projects: testProjectService,
    projectEvents: testProjectEventService,
    projectStages: testProjectStageService,
    projectCollaboration: testProjectCollaborationService,
    projectTasks: testProjectTaskService,
    search: testSearchService,
    teamInvitations: testTeamInvitationService,
  });
}

describe("feature flags API", () => {
  test("rejects anonymous access", async () => {
    const response = await createFeatureFlagApp(
      createFeatureFlagStub(),
      createAuthStub(null),
    ).request("/api/features");

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({
      error: { code: "UNAUTHORIZED", message: "Autenticación requerida." },
    });
  });

  test("requires an active organization", async () => {
    const response = await createFeatureFlagApp(
      createFeatureFlagStub(),
      createAuthStub({
        ...activeSession,
        session: { ...activeSession.session, activeOrganizationId: null },
      }),
    ).request("/api/features");

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      error: {
        code: "ORGANIZATION_REQUIRED",
        message: "Selecciona un estudio para continuar.",
      },
    });
  });

  test("returns effective flags for the authenticated actor", async () => {
    const featureFlags = createFeatureFlagStub();
    const response =
      await createFeatureFlagApp(featureFlags).request("/api/features");

    expect(response.status).toBe(200);
    expect(featureFlags.resolveForActor).toHaveBeenCalledWith({
      userId: "user-1",
      organizationId: "org-1",
    });
    expect(await response.json()).toEqual({
      features: { orbitHelpAssistant: true },
    });
  });

  test("rejects a user without active organization membership", async () => {
    const featureFlags = createFeatureFlagStub(
      vi
        .fn()
        .mockRejectedValue(
          new FeatureFlagServiceError(
            "FORBIDDEN",
            "No tienes acceso a este estudio.",
          ),
        ),
    );
    const response =
      await createFeatureFlagApp(featureFlags).request("/api/features");

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({
      error: {
        code: "FORBIDDEN",
        message: "No tienes acceso a este estudio.",
      },
    });
  });
});
