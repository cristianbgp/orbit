import { describe, expect, test, vi } from "vitest";

import type { AuthService } from "../src/auth/types";
import { createTestApp } from "./support/app";
import { testClientService } from "./support/client-service";
import { testProjectCollaborationService } from "./support/project-collaboration-service";
import { testProjectStageService } from "./support/project-stage-service";
import { testTeamInvitationService } from "./support/team-invitation-service";

const record = {
  id: "event-1",
  organizationId: "org-1",
  projectId: "project-1",
  title: "Audiencia",
  type: "legal" as const,
  date: "2026-08-25",
  description: null,
  createdByUserId: "user-1",
  createdAt: new Date("2026-08-12T10:00:00Z"),
  updatedAt: new Date("2026-08-12T10:00:00Z"),
};

const auth: AuthService = {
  handler: async () => new Response(null, { status: 404 }),
  getSession: async () => ({
    user: { id: "user-1", name: "Cristian", email: "user@orbit.test" },
    session: { id: "session-1", activeOrganizationId: "org-1" },
  }),
};

function eventService() {
  return {
    list: vi.fn().mockResolvedValue({
      events: [record],
      pagination: { page: 1, pageSize: 25, total: 1, totalPages: 1 },
    }),
    create: vi.fn().mockResolvedValue(record),
    update: vi.fn().mockResolvedValue(record),
    remove: vi.fn().mockResolvedValue(undefined),
  };
}

function app(events = eventService()) {
  return {
    events,
    app: createTestApp({
      auth,
      clients: testClientService,
      projects: {
        list: vi.fn(),
        get: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        archive: vi.fn(),
        restore: vi.fn(),
      },
      projectEvents: events,
      projectStages: testProjectStageService,
      projectCollaboration: testProjectCollaborationService,
      teamInvitations: testTeamInvitationService,
    } as never),
  };
}

describe("project event API", () => {
  test("lists serialized legal events", async () => {
    const fixture = app();
    const response = await fixture.app.request(
      "/api/projects/project-1/events?page=1&pageSize=25",
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      events: [
        {
          id: "event-1",
          title: "Audiencia",
          type: "legal",
          date: "2026-08-25",
          description: null,
          createdByUserId: "user-1",
          createdAt: "2026-08-12T10:00:00.000Z",
          updatedAt: "2026-08-12T10:00:00.000Z",
        },
      ],
      pagination: { page: 1, pageSize: 25, total: 1, totalPages: 1 },
    });
  });

  test("creates only a legal event", async () => {
    const fixture = app();
    const response = await fixture.app.request(
      "/api/projects/project-1/events",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: "Audiencia",
          type: "legal",
          date: "2026-08-25",
        }),
      },
    );

    expect(response.status).toBe(201);
    expect(fixture.events.create).toHaveBeenCalledWith(
      { userId: "user-1", organizationId: "org-1" },
      "project-1",
      { title: "Audiencia", type: "legal", date: "2026-08-25" },
    );
  });

  test("rejects meeting creation until the UI/API expansion", async () => {
    const fixture = app();
    const response = await fixture.app.request(
      "/api/projects/project-1/events",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: "Reunión",
          type: "meeting",
          date: "2026-08-25",
        }),
      },
    );
    expect(response.status).toBe(400);
    expect(fixture.events.create).not.toHaveBeenCalled();
  });
});
