import { describe, expect, test, vi } from "vitest";

import type { AuthService } from "../src/auth/types";
import { createTestApp } from "./support/app";
import { testClientService } from "./support/client-service";
import { testProjectCollaborationService } from "./support/project-collaboration-service";
import { testProjectEventService } from "./support/project-event-service";
import { testProjectStageService } from "./support/project-stage-service";
import { testTeamInvitationService } from "./support/team-invitation-service";

const auth: AuthService = {
  handler: async () => new Response(null, { status: 404 }),
  getSession: async () => ({
    user: { id: "user-1", name: "Cristian", email: "user@orbit.test" },
    session: { id: "session-1", activeOrganizationId: "org-1" },
  }),
};

describe("Case Presentation API", () => {
  test("returns and serializes the grouped weekly presentation", async () => {
    const list = vi.fn().mockResolvedValue({
      generatedAt: new Date("2026-09-04T12:00:00.000Z"),
      organizationDate: "2026-09-04",
      truncated: { value: false, scopes: [] },
      clients: [
        {
          id: "client-1",
          name: "Cliente",
          cases: [
            {
              id: "case-1",
              identification: "Proceso tributario",
              status: "in_progress",
              result: null,
              type: "judicial",
              stage: "judicial_first_instance",
              docketNumber: "0001-2026",
              periodKind: "year",
              periodStart: "2026-01-01",
              periodEnd: "2026-12-01",
              team: [],
              followers: [],
              updates: [],
              backgrounds: [],
              actions: [],
              events: [
                {
                  id: "event-1",
                  organizationId: "org-1",
                  caseId: "case-1",
                  title: "Informe oral",
                  type: "oral_argument",
                  date: "2026-09-18",
                  description: null,
                  createdByUserId: "user-1",
                  createdAt: new Date("2026-09-03T10:00:00.000Z"),
                  updatedAt: new Date("2026-09-03T10:00:00.000Z"),
                },
              ],
            },
          ],
        },
      ],
    });
    const app = createTestApp({
      auth,
      clients: testClientService,
      casePresentation: { list },
      projectEvents: testProjectEventService,
      projectStages: testProjectStageService,
      projectCollaboration: testProjectCollaborationService,
      teamInvitations: testTeamInvitationService,
    } as never);

    const response = await app.request(
      "/api/cases/presentation?statuses=in_progress&statuses=concluded&clientIds=client-1&types=judicial&memberUserIds=user-2&includeCompletedActions=true&includePastEvents=true",
    );

    expect(response.status).toBe(200);
    expect(list).toHaveBeenCalledWith(
      { userId: "user-1", organizationId: "org-1" },
      {
        statuses: ["in_progress", "concluded"],
        clientIds: ["client-1"],
        types: ["judicial"],
        memberUserIds: ["user-2"],
        includeCompletedActions: true,
        includePastEvents: true,
      },
    );
    expect(await response.json()).toMatchObject({
      generatedAt: "2026-09-04T12:00:00.000Z",
      organizationDate: "2026-09-04",
      clients: [
        {
          cases: [
            {
              periodKind: "year",
              periodStart: "2026-01-01",
              periodEnd: "2026-12-01",
              events: [
                {
                  id: "event-1",
                  createdAt: "2026-09-03T10:00:00.000Z",
                  updatedAt: "2026-09-03T10:00:00.000Z",
                },
              ],
            },
          ],
        },
      ],
      truncated: { value: false, scopes: [] },
    });
  });
});
