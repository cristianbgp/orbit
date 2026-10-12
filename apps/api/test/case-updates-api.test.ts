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

const createdAt = new Date("2026-09-03T12:00:00.000Z");
const record = {
  id: "update-1",
  organizationId: "org-1",
  caseId: "case-1",
  date: "2026-08-21",
  description: "Sentencia de primera instancia",
  kind: "update" as const,
  creator: {
    userId: "user-1",
    fullName: "Cristian Granda",
    alias: "CG",
    avatarColor: "#4057ed",
    activeStudioMember: true,
    linkable: true,
  },
  createdAt,
  updatedAt: createdAt,
  archivedAt: null,
};

function app(caseUpdates: Record<string, unknown>) {
  return createTestApp({
    auth,
    clients: testClientService,
    projects: testProjectService,
    projectStages: testProjectStageService,
    projectCollaboration: testProjectCollaborationService,
    teamInvitations: testTeamInvitationService,
    caseUpdates,
  } as never);
}

describe("case updates API", () => {
  test("lists active updates with pagination and ISO metadata", async () => {
    const caseUpdates = {
      list: vi.fn().mockResolvedValue({
        updates: [record],
        pagination: {
          page: 1,
          pageSize: 10,
          total: 1,
          totalPages: 1,
        },
      }),
    };

    const response = await app(caseUpdates).request(
      "/api/cases/case-1/updates",
    );

    expect(response.status).toBe(200);
    expect(caseUpdates.list).toHaveBeenCalledWith(
      { userId: "user-1", organizationId: "org-1" },
      "case-1",
      { status: "active", page: 1, pageSize: 10 },
    );
    expect(await response.json()).toMatchObject({
      updates: [
        {
          id: "update-1",
          kind: "update",
          createdAt: "2026-09-03T12:00:00.000Z",
          updatedAt: "2026-09-03T12:00:00.000Z",
          archivedAt: null,
        },
      ],
    });
  });

  test("creates, edits, archives, and restores a case update", async () => {
    const caseUpdates = {
      create: vi.fn().mockResolvedValue(record),
      update: vi.fn().mockResolvedValue(record),
      archive: vi.fn().mockResolvedValue({
        ...record,
        archivedAt: new Date("2026-09-03T13:00:00.000Z"),
      }),
      restore: vi.fn().mockResolvedValue(record),
    };
    const orbit = app(caseUpdates);
    const headers = { "content-type": "application/json" };

    const createResponse = await orbit.request("/api/cases/case-1/updates", {
      method: "POST",
      headers,
      body: JSON.stringify({
        date: "2026-08-21",
        description: "Sentencia de primera instancia",
      }),
    });
    expect(createResponse.status).toBe(201);

    const updateResponse = await orbit.request(
      "/api/cases/case-1/updates/update-1",
      {
        method: "PATCH",
        headers,
        body: JSON.stringify({
          description: "Sentencia notificada",
          kind: "background",
          expectedUpdatedAt: createdAt.toISOString(),
        }),
      },
    );
    expect(updateResponse.status).toBe(200);
    expect(caseUpdates.update).toHaveBeenCalledWith(
      { userId: "user-1", organizationId: "org-1" },
      "case-1",
      "update-1",
      {
        description: "Sentencia notificada",
        kind: "background",
        expectedUpdatedAt: createdAt.toISOString(),
      },
    );

    const archiveResponse = await orbit.request(
      "/api/cases/case-1/updates/update-1/archive",
      {
        method: "POST",
        headers,
        body: JSON.stringify({ expectedUpdatedAt: createdAt.toISOString() }),
      },
    );
    expect(archiveResponse.status).toBe(200);

    const restoreResponse = await orbit.request(
      "/api/cases/case-1/updates/update-1/restore",
      {
        method: "POST",
        headers,
        body: JSON.stringify({ expectedUpdatedAt: createdAt.toISOString() }),
      },
    );
    expect(restoreResponse.status).toBe(200);
    expect(caseUpdates.archive).toHaveBeenCalledWith(
      { userId: "user-1", organizationId: "org-1" },
      "case-1",
      "update-1",
      createdAt.toISOString(),
    );
    expect(caseUpdates.restore).toHaveBeenCalledWith(
      { userId: "user-1", organizationId: "org-1" },
      "case-1",
      "update-1",
      createdAt.toISOString(),
    );
  });

  test("previews and moves active novelties across the organization", async () => {
    const caseUpdates = {
      previewMoveAllToBackground: vi
        .fn()
        .mockResolvedValue({ movedCount: 4, caseCount: 2 }),
      moveAllToBackground: vi
        .fn()
        .mockResolvedValue({ movedCount: 4, caseCount: 2 }),
    };

    const previewResponse = await app(caseUpdates).request(
      "/api/cases/updates/move-to-background/preview",
    );

    const response = await app(caseUpdates).request(
      "/api/cases/updates/move-to-background",
      { method: "POST" },
    );

    expect(previewResponse.status).toBe(200);
    expect(await previewResponse.json()).toEqual({
      movedCount: 4,
      caseCount: 2,
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ movedCount: 4, caseCount: 2 });
    expect(caseUpdates.previewMoveAllToBackground).toHaveBeenCalledWith({
      userId: "user-1",
      organizationId: "org-1",
    });
    expect(caseUpdates.moveAllToBackground).toHaveBeenCalledWith({
      userId: "user-1",
      organizationId: "org-1",
    });
  });

  test("rejects an empty description at the contract boundary", async () => {
    const response = await app({ create: vi.fn() }).request(
      "/api/cases/case-1/updates",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ date: "2026-08-21", description: "   " }),
      },
    );

    expect(response.status).toBe(400);
  });
});
