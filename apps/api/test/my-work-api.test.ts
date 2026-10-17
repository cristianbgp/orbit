import { describe, expect, test, vi } from "vitest";

import { createApp } from "../src/app";
import type { AuthService } from "../src/auth/types";
import { testClientService } from "./support/client-service";
import { testDashboardService } from "./support/dashboard-service";
import { testIdentityService } from "./support/identity-service";
import { testProjectCollaborationService } from "./support/project-collaboration-service";
import { testProjectService } from "./support/project-service";
import { testProjectStageService } from "./support/project-stage-service";
import { testProjectTaskService } from "./support/project-task-service";
import { testProjectEventService } from "./support/project-event-service";
import { testTeamInvitationService } from "./support/team-invitation-service";
import { testSearchService } from "./support/search-service";
import { testFeatureFlagService } from "./support/feature-flag-service";
import { testAccountRecoveryService } from "./support/account-recovery-service";

const session = {
  user: { id: "user-1", name: "Ana", email: "ana@orbit.test" },
  session: { id: "s-1", activeOrganizationId: "org-1" },
};
function auth(value: typeof session | null): AuthService {
  return {
    handler: async () => new Response(null, { status: 404 }),
    getSession: async () => value,
  };
}
const assignedResult = {
  today: "2026-08-10",
  tasks: [],
  pagination: { page: 2, pageSize: 10, total: 0, totalPages: 0 },
};
const supervisionResult = {
  today: "2026-08-10",
  projects: [],
  pagination: { page: 1, pageSize: 25, total: 0, totalPages: 0 },
};
const caseActionsResult = {
  actions: [
    {
      id: "action-1",
      description: "Preparar escrito",
      status: "pending",
      updatedAt: new Date("2026-09-03T12:00:00.000Z"),
      completedAt: null,
      case: {
        id: "case-1",
        identification: "Proceso 2026",
        type: "judicial",
        client: { id: "client-1", name: "Cliente ejemplo" },
      },
    },
  ],
  pagination: { page: 1, pageSize: 25, total: 1, totalPages: 1 },
};

function setup(authService: AuthService = auth(session)) {
  const myWork = {
    assignedTasks: vi.fn().mockResolvedValue(assignedResult),
    supervision: vi.fn().mockResolvedValue(supervisionResult),
    caseActions: vi.fn().mockResolvedValue(caseActionsResult),
  };
  const app = createApp({
    auth: authService,
    accountRecovery: testAccountRecoveryService,
    featureFlags: testFeatureFlagService,
    clients: testClientService,
    dashboard: testDashboardService,
    search: testSearchService,
    identity: testIdentityService,
    projects: testProjectService,
    projectEvents: testProjectEventService,
    projectStages: testProjectStageService,
    projectCollaboration: testProjectCollaborationService,
    projectTasks: testProjectTaskService,
    teamInvitations: testTeamInvitationService,
    myWork: myWork as never,
  });
  return { app, myWork };
}

describe("my work API", () => {
  test("rejects anonymous access", async () => {
    expect(
      (await setup(auth(null)).app.request("/api/my-work/tasks")).status,
    ).toBe(401);
  });

  test("passes the session actor and repeated assigned-task filters", async () => {
    const { app, myWork } = setup();
    const response = await app.request(
      "/api/my-work/tasks?page=2&pageSize=10&projectId=p-1&projectId=p-2&status=pending&status=blocked&includeCompleted=true",
    );
    expect(response.status).toBe(200);
    expect(myWork.assignedTasks).toHaveBeenCalledWith(
      { userId: "user-1", organizationId: "org-1" },
      {
        page: 2,
        pageSize: 10,
        projectId: ["p-1", "p-2"],
        status: ["pending", "blocked"],
        includeCompleted: true,
      },
    );
    expect(await response.json()).toEqual(assignedResult);
  });

  test("uses the session actor for supervision", async () => {
    const { app, myWork } = setup();
    expect((await app.request("/api/my-work/supervision")).status).toBe(200);
    expect(myWork.supervision).toHaveBeenCalledWith(
      { userId: "user-1", organizationId: "org-1" },
      {
        page: 1,
        pageSize: 25,
        projectId: [],
        status: [],
        includeCompleted: false,
      },
    );
  });

  test("lists case actions assigned to the session user", async () => {
    const { app, myWork } = setup();
    const response = await app.request(
      "/api/my-work/case-actions?type=judicial&includeCompleted=true",
    );
    expect(response.status).toBe(200);
    expect(myWork.caseActions).toHaveBeenCalledWith(
      { userId: "user-1", organizationId: "org-1" },
      {
        page: 1,
        pageSize: 25,
        clientId: [],
        caseId: [],
        type: ["judicial"],
        includeCompleted: true,
      },
    );
    expect(await response.json()).toMatchObject({
      actions: [{ id: "action-1", updatedAt: "2026-09-03T12:00:00.000Z" }],
    });
  });
});
