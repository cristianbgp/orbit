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
    user: { id: "user-1", name: "Cristian", email: "c@orbit.test" },
    session: { id: "session-1", activeOrganizationId: "org-1" },
  }),
};
const now = new Date("2026-09-03T12:00:00.000Z");
const identity = {
  userId: "user-1",
  fullName: "Cristian Granda",
  alias: "CG",
  avatarColor: "#4057ed",
  activeStudioMember: true,
  activeCaseMember: true,
  linkable: true,
};
const record = {
  id: "action-1",
  organizationId: "org-1",
  caseId: "case-1",
  description: "Preparar escrito",
  status: "pending",
  assignee: identity,
  creator: identity,
  completedAt: null,
  completedByUserId: null,
  createdAt: now,
  updatedAt: now,
  archivedAt: null,
};

function app(caseActions: Record<string, unknown>) {
  return createTestApp({
    auth,
    clients: testClientService,
    projects: testProjectService,
    projectStages: testProjectStageService,
    projectCollaboration: testProjectCollaborationService,
    teamInvitations: testTeamInvitationService,
    caseActions,
  } as never);
}

describe("case actions API", () => {
  test("lists actions with pagination and serialized timestamps", async () => {
    const caseActions = {
      list: vi.fn().mockResolvedValue({
        actions: [record],
        pagination: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
      }),
    };
    const response = await app(caseActions).request(
      "/api/cases/case-1/actions",
    );
    expect(response.status).toBe(200);
    expect(caseActions.list).toHaveBeenCalledWith(
      { userId: "user-1", organizationId: "org-1" },
      "case-1",
      { status: "pending", page: 1, pageSize: 20 },
    );
    expect(await response.json()).toMatchObject({
      actions: [{ id: "action-1", createdAt: now.toISOString() }],
    });
  });

  test("accepts the combined active action scope", async () => {
    const caseActions = {
      list: vi.fn().mockResolvedValue({
        actions: [record],
        pagination: { page: 1, pageSize: 3, total: 1, totalPages: 1 },
      }),
    };
    const response = await app(caseActions).request(
      "/api/cases/case-1/actions?status=active&pageSize=3",
    );
    expect(response.status).toBe(200);
    expect(caseActions.list).toHaveBeenCalledWith(
      { userId: "user-1", organizationId: "org-1" },
      "case-1",
      { status: "active", page: 1, pageSize: 3 },
    );
  });

  test("creates, edits, completes, reopens, archives and restores", async () => {
    const caseActions = {
      create: vi.fn().mockResolvedValue(record),
      update: vi.fn().mockResolvedValue(record),
      complete: vi.fn().mockResolvedValue({
        ...record,
        status: "completed",
        completedAt: now,
      }),
      reopen: vi.fn().mockResolvedValue(record),
      archive: vi.fn().mockResolvedValue({ ...record, archivedAt: now }),
      restore: vi.fn().mockResolvedValue(record),
    };
    const orbit = app(caseActions);
    const headers = { "content-type": "application/json" };
    expect(
      (
        await orbit.request("/api/cases/case-1/actions", {
          method: "POST",
          headers,
          body: JSON.stringify({ description: "Preparar escrito" }),
        })
      ).status,
    ).toBe(201);
    expect(
      (
        await orbit.request("/api/cases/case-1/actions/action-1", {
          method: "PATCH",
          headers,
          body: JSON.stringify({
            assigneeUserId: null,
            expectedUpdatedAt: now.toISOString(),
          }),
        })
      ).status,
    ).toBe(200);
    for (const action of ["complete", "reopen", "archive", "restore"])
      expect(
        (
          await orbit.request(`/api/cases/case-1/actions/action-1/${action}`, {
            method: "POST",
            headers,
            body: JSON.stringify({ expectedUpdatedAt: now.toISOString() }),
          })
        ).status,
      ).toBe(200);
  });

  test("rejects empty descriptions", async () => {
    const response = await app({ create: vi.fn() }).request(
      "/api/cases/case-1/actions",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ description: "   " }),
      },
    );
    expect(response.status).toBe(400);
  });
});
