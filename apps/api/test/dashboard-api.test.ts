import { describe, expect, test, vi } from "vitest";

import { createApp } from "../src/app";
import type { AuthService, AuthSession } from "../src/auth/types";
import { DashboardServiceError } from "../src/dashboard/dashboard-service";
import { testClientService } from "./support/client-service";
import { testIdentityService } from "./support/identity-service";
import { testProjectCollaborationService } from "./support/project-collaboration-service";
import { testProjectService } from "./support/project-service";
import { testProjectStageService } from "./support/project-stage-service";
import { testProjectTaskService } from "./support/project-task-service";
import { testTeamInvitationService } from "./support/team-invitation-service";

const activeSession = {
  user: { id: "user-1", name: "Cristian", email: "user@orbit.pe" },
  session: { id: "session-1", activeOrganizationId: "org-1" },
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

const activity = {
  id: "activity-1",
  source: "project" as const,
  case: null,
  organizationId: "org-1",
  projectId: "project-1",
  project: {
    id: "project-1",
    name: "Recurso de apelación",
    status: "completed" as const,
    archivedAt: new Date("2026-08-10T16:00:00.000Z"),
  },
  type: "task.status_changed" as const,
  actor: {
    userId: "user-1",
    alias: "CG",
    avatarColor: "#11182b",
    nameSnapshot: "Cristian Granda",
    activeStudioMember: true,
    linkable: true,
  },
  subject: null,
  details: { taskId: "task-1", taskTitle: "Preparar escrito" },
  createdAt: new Date("2026-08-10T15:00:00.000Z"),
};

function createDashboardApp({
  auth = createAuthStub(activeSession),
  dashboard = {
    activity: vi.fn().mockResolvedValue({
      timeZone: "America/Lima",
      activities: [activity],
      nextCursor: "next-page",
    }),
  },
}: {
  auth?: AuthService;
  dashboard?: { activity: ReturnType<typeof vi.fn> };
} = {}) {
  return {
    app: createApp({
      auth,
      clients: testClientService,
      dashboard: dashboard as never,
      identity: testIdentityService,
      projects: testProjectService,
      projectStages: testProjectStageService,
      projectCollaboration: testProjectCollaborationService,
      projectTasks: testProjectTaskService,
      teamInvitations: testTeamInvitationService,
    } as never),
    dashboard,
  };
}

describe("dashboard activity API", () => {
  test("does not expose the retired studio overview", async () => {
    const { app } = createDashboardApp();

    expect((await app.request("/api/dashboard/overview")).status).toBe(404);
  });

  test("rejects anonymous activity access", async () => {
    const { app } = createDashboardApp({ auth: createAuthStub(null) });

    expect((await app.request("/api/dashboard/activity")).status).toBe(401);
  });

  test("requires an active organization", async () => {
    const { app } = createDashboardApp({
      auth: createAuthStub({
        ...activeSession,
        session: { ...activeSession.session, activeOrganizationId: null },
      }),
    });

    expect((await app.request("/api/dashboard/activity")).status).toBe(409);
  });

  test("maps a missing studio membership to forbidden", async () => {
    const dashboard = {
      activity: vi
        .fn()
        .mockRejectedValue(
          new DashboardServiceError(
            "FORBIDDEN",
            "No tienes acceso a este estudio.",
          ),
        ),
    };
    const { app } = createDashboardApp({ dashboard });

    expect((await app.request("/api/dashboard/activity")).status).toBe(403);
  });

  test("returns a serialized page of studio activity", async () => {
    const { app, dashboard } = createDashboardApp();
    const response = await app.request("/api/dashboard/activity?pageSize=25");

    expect(response.status).toBe(200);
    expect(dashboard.activity).toHaveBeenCalledWith(
      { userId: "user-1", organizationId: "org-1" },
      { pageSize: 25 },
    );
    expect(await response.json()).toEqual({
      timeZone: "America/Lima",
      activities: [
        {
          id: "activity-1",
          source: "project",
          case: null,
          project: {
            id: "project-1",
            name: "Recurso de apelación",
            status: "completed",
            archivedAt: "2026-08-10T16:00:00.000Z",
          },
          type: "task.status_changed",
          actor: activity.actor,
          subject: null,
          details: { taskId: "task-1", taskTitle: "Preparar escrito" },
          createdAt: "2026-08-10T15:00:00.000Z",
        },
      ],
      nextCursor: "next-page",
    });
  });

  test("rejects an invalid activity page size", async () => {
    const { app, dashboard } = createDashboardApp();
    const response = await app.request("/api/dashboard/activity?pageSize=51");

    expect(response.status).toBe(400);
    expect(dashboard.activity).not.toHaveBeenCalled();
  });

  test("maps a malformed activity cursor to validation error", async () => {
    const dashboard = {
      activity: vi
        .fn()
        .mockRejectedValue(
          new DashboardServiceError("INVALID_CURSOR", "Cursor inválido."),
        ),
    };
    const { app } = createDashboardApp({ dashboard });
    const response = await app.request(
      "/api/dashboard/activity?cursor=not-a-cursor",
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: { code: "INVALID_CURSOR", message: "Cursor inválido." },
    });
  });
});
