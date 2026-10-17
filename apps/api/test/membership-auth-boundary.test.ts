import { describe, expect, test } from "vitest";

import { createOrbitAuth } from "../src/auth/create-auth";
import { createTestApp } from "./support/app";
import { testClientService } from "./support/client-service";
import { testProjectCollaborationService } from "./support/project-collaboration-service";
import { testProjectService } from "./support/project-service";
import { testProjectStageService } from "./support/project-stage-service";
import { testTeamInvitationService } from "./support/team-invitation-service";

function appWithRealAuthHandler() {
  const { authService } = createOrbitAuth({
    db: {} as never,
    baseURL: "http://localhost:3000",
    secret: "test-secret-at-least-32-characters-long",
    trustedOrigin: "http://localhost:5173",
  });

  return createTestApp({
    auth: authService,
    clients: testClientService,
    projects: testProjectService,
    projectStages: testProjectStageService,
    teamInvitations: testTeamInvitationService,
    projectCollaboration: testProjectCollaborationService,
  });
}

describe("membership authentication boundary", () => {
  test.each([
    "/api/auth/organization/remove-member",
    "/api/auth/organization/leave",
  ])("does not expose Better Auth membership deletion at %s", async (path) => {
    const response = await appWithRealAuthHandler().request(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });

    expect(response.status).toBe(404);
    expect(await response.text()).toBe("Not Found");
  });

  test("keeps the session route mounted on the same real auth handler", async () => {
    const response = await appWithRealAuthHandler().request(
      "/api/auth/get-session",
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toBeNull();
  });
});
