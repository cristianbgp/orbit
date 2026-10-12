import { describe, expect, test, vi } from "vitest";

import type { AuthService } from "../src/auth/types";
import { createTestApp } from "./support/app";
import { testClientService } from "./support/client-service";
import { testProjectCollaborationService } from "./support/project-collaboration-service";
import { testProjectService } from "./support/project-service";
import { testProjectStageService } from "./support/project-stage-service";
import { testTeamInvitationService } from "./support/team-invitation-service";

const auth: AuthService = {
  handler: async () => new Response(null, { status: 404 }),
  getSession: async () => ({
    user: { id: "user-1", name: "Cristian", email: "cristian@orbit.test" },
    session: { id: "session-1", activeOrganizationId: "org-1" },
  }),
};

const record = {
  id: "case-1",
  organizationId: "org-1",
  clientId: "client-1",
  client: { id: "client-1", name: "BBVA" },
  identification: "IR 2000 - DCA BBVA",
  type: "judicial",
  subtype: "dca",
  stage: "judicial_first_instance",
  entity: "judiciary",
  docketNumber: "08549-2021",
  tax: "IR",
  periodKind: "year",
  periodStart: "2000-01-01",
  periodEnd: "2000-12-01",
  amount: "15500000.00",
  currency: "PEN",
  claimantType: "client",
  disputedMatter: null,
  challengedResolution: "07532-9-2021",
  status: "in_progress",
  result: null,
  archivedAt: null,
  createdByUserId: "user-1",
  createdAt: new Date("2026-09-02T10:00:00Z"),
  updatedAt: new Date("2026-09-02T10:00:00Z"),
  team: { members: [], total: 0 },
  followers: { members: [], total: 0 },
} as const;

function app(cases: Record<string, unknown>) {
  return createTestApp({
    auth,
    clients: testClientService,
    projects: testProjectService,
    projectStages: testProjectStageService,
    projectCollaboration: testProjectCollaborationService,
    teamInvitations: testTeamInvitationService,
    cases,
  } as never);
}

describe("cases API", () => {
  test("lists active cases using explicit pagination", async () => {
    const cases = {
      list: vi.fn().mockResolvedValue({
        cases: [record],
        pagination: { page: 1, pageSize: 25, total: 1, totalPages: 1 },
      }),
    };
    const response = await app(cases).request(
      "/api/cases?type=judicial&status=in_progress",
    );
    expect(response.status).toBe(200);
    expect(cases.list).toHaveBeenCalledWith(
      { userId: "user-1", organizationId: "org-1" },
      { type: ["judicial"], status: ["in_progress"], page: 1, pageSize: 25 },
    );
    expect(await response.json()).toMatchObject({
      cases: [{ id: "case-1", identification: "IR 2000 - DCA BBVA" }],
    });
  });

  test("returns the fixed options and creates a minimum case", async () => {
    const cases = { create: vi.fn().mockResolvedValue(record) };
    const optionsResponse = await app(cases).request("/api/cases/options");
    expect(optionsResponse.status).toBe(200);
    const options = (await optionsResponse.json()) as {
      types: Array<{ value: string; label: string }>;
    };
    expect(options.types).toEqual(
      expect.arrayContaining([
        { value: "administrative", label: "Administrativo" },
      ]),
    );

    const response = await app(cases).request("/api/cases", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        clientId: "client-1",
        identification: "IR 2000 - DCA BBVA",
      }),
    });
    expect(response.status).toBe(201);
    expect(cases.create).toHaveBeenCalledWith(
      { userId: "user-1", organizationId: "org-1" },
      { clientId: "client-1", identification: "IR 2000 - DCA BBVA" },
    );
  });
});
