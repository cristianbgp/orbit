import { describe, expect, test, vi } from "vitest";

import type { AuthService } from "../src/auth/types";
import { createTestApp } from "./support/app";
import { testClientService } from "./support/client-service";
import { testProjectCollaborationService } from "./support/project-collaboration-service";
import { testProjectEventService } from "./support/project-event-service";
import { testProjectStageService } from "./support/project-stage-service";
import { testTeamInvitationService } from "./support/team-invitation-service";

const record = {
  id: "event-1",
  organizationId: "org-1",
  caseId: "case-1",
  title: "Vista de la causa",
  type: "oral_argument" as const,
  date: "2026-09-18",
  description: null,
  createdByUserId: "user-1",
  createdAt: new Date("2026-09-03T10:00:00Z"),
  updatedAt: new Date("2026-09-03T10:00:00Z"),
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
    calendar: vi.fn().mockResolvedValue({
      events: [
        {
          ...record,
          case: {
            id: "case-1",
            identification: "Proceso tributario",
            status: "in_progress",
            type: "judicial",
            stage: "judicial_first_instance",
            docketNumber: "0001-2026",
            client: { id: "client-1", name: "Cliente" },
          },
        },
      ],
      truncated: false,
    }),
    list: vi.fn().mockResolvedValue({
      events: [record],
      pagination: { page: 1, pageSize: 25, total: 1, totalPages: 1 },
    }),
    create: vi.fn().mockResolvedValue(record),
    update: vi.fn().mockResolvedValue(record),
    remove: vi.fn().mockResolvedValue(undefined),
  };
}

function fixture() {
  const events = eventService();
  return {
    events,
    app: createTestApp({
      auth,
      clients: testClientService,
      caseEvents: events,
      projectEvents: testProjectEventService,
      projectStages: testProjectStageService,
      projectCollaboration: testProjectCollaborationService,
      teamInvitations: testTeamInvitationService,
    } as never),
  };
}

describe("case event API", () => {
  test("lists the organization calendar with case portfolio filters", async () => {
    const test = fixture();
    const response = await test.app.request(
      "/api/case-events/calendar?from=2026-08-31&to=2026-10-11&caseStatus=in_progress&search=informe&type=judicial&client=client-1&member=user-2",
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      events: [
        {
          id: "event-1",
          title: "Vista de la causa",
          type: "oral_argument",
          date: "2026-09-18",
          description: null,
          createdByUserId: "user-1",
          createdAt: "2026-09-03T10:00:00.000Z",
          updatedAt: "2026-09-03T10:00:00.000Z",
          case: {
            id: "case-1",
            identification: "Proceso tributario",
            status: "in_progress",
            type: "judicial",
            stage: "judicial_first_instance",
            docketNumber: "0001-2026",
            client: { id: "client-1", name: "Cliente" },
          },
        },
      ],
      truncated: false,
    });
    expect(test.events.calendar).toHaveBeenCalledWith(
      { userId: "user-1", organizationId: "org-1" },
      {
        from: "2026-08-31",
        to: "2026-10-11",
        caseStatus: "in_progress",
        search: "informe",
        types: ["judicial"],
        clientIds: ["client-1"],
        memberUserIds: ["user-2"],
      },
    );
  });

  test("lists serialized oral-hearing events", async () => {
    const test = fixture();
    const response = await test.app.request(
      "/api/cases/case-1/events?page=1&pageSize=25",
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      events: [
        {
          id: "event-1",
          title: "Vista de la causa",
          type: "oral_argument",
          date: "2026-09-18",
          description: null,
          createdByUserId: "user-1",
          createdAt: "2026-09-03T10:00:00.000Z",
          updatedAt: "2026-09-03T10:00:00.000Z",
        },
      ],
      pagination: { page: 1, pageSize: 25, total: 1, totalPages: 1 },
    });
    expect(test.events.list).toHaveBeenCalledWith(
      { userId: "user-1", organizationId: "org-1" },
      "case-1",
      { page: 1, pageSize: 25 },
    );
  });

  test("creates only an oral-hearing event", async () => {
    const test = fixture();
    const response = await test.app.request("/api/cases/case-1/events", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title: "Vista de la causa",
        type: "oral_argument",
        date: "2026-09-18",
      }),
    });

    expect(response.status).toBe(201);
    expect(test.events.create).toHaveBeenCalledWith(
      { userId: "user-1", organizationId: "org-1" },
      "case-1",
      {
        title: "Vista de la causa",
        type: "oral_argument",
        date: "2026-09-18",
      },
    );
  });

  test("rejects event types that are not enabled for cases", async () => {
    const test = fixture();
    const response = await test.app.request("/api/cases/case-1/events", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title: "Reunión",
        type: "meeting",
        date: "2026-09-18",
      }),
    });

    expect(response.status).toBe(400);
    expect(test.events.create).not.toHaveBeenCalled();
  });

  test("updates and deletes an event within its case", async () => {
    const test = fixture();
    const updateResponse = await test.app.request(
      "/api/cases/case-1/events/event-1",
      {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: "Informe reprogramado",
          expectedUpdatedAt: "2026-09-03T10:00:00.000Z",
        }),
      },
    );
    const deleteResponse = await test.app.request(
      "/api/cases/case-1/events/event-1",
      {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          expectedUpdatedAt: "2026-09-03T10:00:00.000Z",
        }),
      },
    );

    expect(updateResponse.status).toBe(200);
    expect(test.events.update).toHaveBeenCalledWith(
      { userId: "user-1", organizationId: "org-1" },
      "case-1",
      "event-1",
      {
        title: "Informe reprogramado",
        expectedUpdatedAt: "2026-09-03T10:00:00.000Z",
      },
    );
    expect(deleteResponse.status).toBe(204);
    expect(test.events.remove).toHaveBeenCalledWith(
      { userId: "user-1", organizationId: "org-1" },
      "case-1",
      "event-1",
      "2026-09-03T10:00:00.000Z",
    );
  });
});
