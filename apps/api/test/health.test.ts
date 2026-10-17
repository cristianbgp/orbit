import { describe, expect, test } from "vitest";

import { createTestApp as createApp } from "./support/app";
import type { AuthService } from "../src/auth/types";
import { testClientService } from "./support/client-service";
import { testProjectService } from "./support/project-service";
import { testProjectStageService } from "./support/project-stage-service";
import { testTeamInvitationService } from "./support/team-invitation-service";
import { testProjectCollaborationService } from "./support/project-collaboration-service";

const anonymousAuth: AuthService = {
  handler: async () => new Response(null, { status: 404 }),
  getSession: async () => null,
};

describe("Orbit API", () => {
  test("returns the Orbit API health payload", async () => {
    const response = await createApp({
      auth: anonymousAuth,
      clients: testClientService,
      projects: testProjectService,
      projectStages: testProjectStageService,
      teamInvitations: testTeamInvitationService,
      projectCollaboration: testProjectCollaborationService,
    }).request("/health");

    expect(response.status).toBe(200);
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(response.headers.get("referrer-policy")).toBe("no-referrer");
    expect(await response.json()).toEqual({
      status: "ok",
      service: "orbit-api",
    });
  });

  test("returns 404 for an unknown route", async () => {
    const response = await createApp({
      auth: anonymousAuth,
      clients: testClientService,
      projects: testProjectService,
      projectStages: testProjectStageService,
      teamInvitations: testTeamInvitationService,
      projectCollaboration: testProjectCollaborationService,
    }).request("/missing");

    expect(response.status).toBe(404);
  });
});
