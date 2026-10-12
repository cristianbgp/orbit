import { describe, expect, test } from "vitest";

import { createTestApp as createApp } from "./support/app";
import type { AuthService, AuthSession } from "../src/auth/types";
import { testClientService } from "./support/client-service";
import { testProjectService } from "./support/project-service";
import { testProjectStageService } from "./support/project-stage-service";
import { testTeamInvitationService } from "./support/team-invitation-service";
import { testProjectCollaborationService } from "./support/project-collaboration-service";

function createAuthStub(session: AuthSession | null = null): AuthService {
  return {
    handler: async () => Response.json({ mounted: true }),
    getSession: async () => session,
  };
}

describe("authentication boundary", () => {
  test("rejects anonymous access to the current user", async () => {
    const response = await createApp({
      auth: createAuthStub(),
      clients: testClientService,
      projects: testProjectService,
      projectStages: testProjectStageService,
      teamInvitations: testTeamInvitationService,
      projectCollaboration: testProjectCollaborationService,
    }).request("/api/me");

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({
      error: {
        code: "UNAUTHORIZED",
        message: "Autenticación requerida.",
      },
    });
  });

  test("returns the authenticated user's stored public profile", async () => {
    const session: AuthSession = {
      user: {
        id: "user-1",
        name: "Cristian",
        email: "user@orbit.pe",
      },
      session: { id: "session-1", activeOrganizationId: null },
    };
    const response = await createApp({
      auth: createAuthStub(session),
      clients: testClientService,
      projects: testProjectService,
      projectStages: testProjectStageService,
      teamInvitations: testTeamInvitationService,
      projectCollaboration: testProjectCollaborationService,
    }).request("/api/me");

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      user: {
        id: "user-1",
        alias: "CRI",
        name: "Cristian Granda",
        email: "cristian@orbit.pe",
      },
    });
  });

  test.each([
    ["GET", "/api/auth/session"],
    ["POST", "/api/auth/sign-in/email"],
  ])("mounts Better Auth for %s requests", async (method, path) => {
    const response = await createApp({
      auth: createAuthStub(),
      clients: testClientService,
      projects: testProjectService,
      projectStages: testProjectStageService,
      teamInvitations: testTeamInvitationService,
      projectCollaboration: testProjectCollaborationService,
    }).request(path, {
      method,
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ mounted: true });
  });

  test("allows credentialed auth preflight from the configured web origin", async () => {
    const response = await createApp({
      allowedOrigin: "http://localhost:5173",
      auth: createAuthStub(),
      clients: testClientService,
      projects: testProjectService,
      projectStages: testProjectStageService,
      teamInvitations: testTeamInvitationService,
      projectCollaboration: testProjectCollaborationService,
    }).request("/api/auth/sign-in/email", {
      method: "OPTIONS",
      headers: {
        Origin: "http://localhost:5173",
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "Content-Type",
      },
    });

    expect(response.headers.get("Access-Control-Allow-Origin")).toBe(
      "http://localhost:5173",
    );
    expect(response.headers.get("Access-Control-Allow-Credentials")).toBe(
      "true",
    );
    expect(response.headers.get("Access-Control-Allow-Methods")).toContain(
      "POST",
    );
  });

  test("does not grant CORS access to another origin", async () => {
    const response = await createApp({
      allowedOrigin: "http://localhost:5173",
      auth: createAuthStub(),
      clients: testClientService,
      projects: testProjectService,
      projectStages: testProjectStageService,
      teamInvitations: testTeamInvitationService,
      projectCollaboration: testProjectCollaborationService,
    }).request("/api/auth/session", {
      headers: { Origin: "https://malicious.example" },
    });

    expect(response.headers.get("Access-Control-Allow-Origin")).toBeNull();
  });
});
