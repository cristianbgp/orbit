import { describe, expect, test, vi } from "vitest";

import { createTestApp as createApp } from "./support/app";
import type { AuthService, AuthSession } from "../src/auth/types";
import {
  ProjectCollaborationServiceError,
  type ProjectCollaborationService,
} from "../src/project-collaboration/project-collaboration-service";
import { testClientService } from "./support/client-service";
import { testProjectService } from "./support/project-service";
import { testProjectStageService } from "./support/project-stage-service";
import { testTeamInvitationService } from "./support/team-invitation-service";

const now = new Date("2026-08-06T20:00:00.000Z");
const actor = { userId: "user-1", organizationId: "org-1" };
const assignment = {
  id: "assignment-1",
  organizationId: "org-1",
  projectId: "project-1",
  userId: "user-2",
  userName: "Cristian Granda Pastora",
  userEmail: "cristian@orbit.pe",
  userAlias: "CGP",
  activeStudioMember: true,
  responsibility: "responsible" as const,
  assignedByUserId: "user-1",
  assignedByName: "Ana Torres",
  assignedAt: now,
  endedAt: null,
  endedByUserId: null,
  endedByName: null,
  endReason: null,
};
const formerAssignment = {
  ...assignment,
  id: "assignment-former",
  userId: "user-former",
  userName: "Former Member",
  userEmail: "former@orbit.pe",
  userAlias: "FM",
  activeStudioMember: false,
  endedAt: now,
  endedByUserId: "user-1",
  endedByName: "Ana Torres",
  endReason: "organization_removed" as const,
};
const activity = {
  id: "activity-1",
  organizationId: "org-1",
  projectId: "project-1",
  type: "project_assignment.responsibility_changed",
  actor: {
    userId: "user-1",
    alias: "AT",
    nameSnapshot: "Ana Torres",
    activeStudioMember: true,
    linkable: true,
  },
  subject: {
    userId: "user-2",
    alias: null,
    nameSnapshot: "Luis Ramos",
    activeStudioMember: false,
    linkable: false,
  },
  details: {
    assignmentId: "assignment-1",
    previousResponsibility: "member",
    newResponsibility: "responsible",
  },
  createdAt: now,
};

const activeSession: AuthSession = {
  user: { id: "user-1", name: "Ana Torres", email: "ana@orbit.pe" },
  session: { id: "session-1", activeOrganizationId: "org-1" },
};

function authStub(session: AuthSession | null = activeSession): AuthService {
  return {
    handler: async () => new Response(null, { status: 404 }),
    getSession: async () => session,
  };
}

function collaborationStub(
  overrides: Partial<
    Record<keyof ProjectCollaborationService, ReturnType<typeof vi.fn>>
  > = {},
) {
  return {
    listAssignments: vi.fn().mockResolvedValue({
      active: [assignment],
      history: [formerAssignment],
      historyPagination: { page: 1, pageSize: 25, total: 1, totalPages: 1 },
    }),
    listCandidates: vi.fn().mockResolvedValue({
      candidates: [
        {
          memberId: "member-2",
          userId: "user-2",
          name: "Cristian Granda Pastora",
          email: "cristian@orbit.pe",
          userAlias: "CGP",
          activeStudioMember: true,
          assigned: true,
        },
      ],
      pagination: { page: 1, pageSize: 25, total: 1, totalPages: 1 },
    }),
    addAssignments: vi.fn().mockResolvedValue([assignment]),
    changeResponsibility: vi.fn().mockResolvedValue(assignment),
    endAssignment: vi.fn().mockResolvedValue(assignment),
    listActivities: vi.fn().mockResolvedValue({
      activities: [activity],
      pagination: { page: 1, pageSize: 25, total: 1, totalPages: 1 },
    }),
    removeOrganizationMember: vi.fn().mockResolvedValue({
      id: "member-2",
      userId: "user-2",
      name: "Luis Ramos",
    }),
    ...overrides,
  };
}

function app(
  projectCollaboration = collaborationStub(),
  auth: AuthService = authStub(),
) {
  return createApp({
    auth,
    clients: testClientService,
    projects: testProjectService,
    projectStages: testProjectStageService,
    teamInvitations: testTeamInvitationService,
    projectCollaboration: projectCollaboration as ProjectCollaborationService,
  });
}

describe("project collaboration API", () => {
  test("returns the shared archived-project conflict for team writes", async () => {
    const projectCollaboration = collaborationStub({
      addAssignments: vi
        .fn()
        .mockRejectedValue(
          new ProjectCollaborationServiceError(
            "PROJECT_ARCHIVED",
            "El proyecto está archivado. Restáuralo para realizar cambios.",
          ),
        ),
    });
    const response = await app(projectCollaboration).request(
      "/api/projects/project-1/assignments",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assignments: [{ userId: "user-2", responsibility: "member" }],
        }),
      },
    );

    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({
      error: { code: "PROJECT_ARCHIVED" },
    });
  });

  test("lists serialized current and former assignments", async () => {
    const projectCollaboration = collaborationStub();
    const response = await app(projectCollaboration).request(
      "/api/projects/project-1/assignments?historyPage=2&historyPageSize=10",
    );

    expect(response.status).toBe(200);
    expect(projectCollaboration.listAssignments).toHaveBeenCalledWith(
      actor,
      "project-1",
      { historyPage: 2, historyPageSize: 10 },
    );
    const body = (await response.json()) as {
      active: Array<Record<string, unknown> & { assignedAt: string }>;
      history: Array<Record<string, unknown>>;
    };
    expect(body.active[0]?.assignedAt).toBe(now.toISOString());
    expect(body.active[0]).toMatchObject({
      userAlias: "CGP",
      activeStudioMember: true,
      userName: "Cristian Granda Pastora",
    });
    expect(body.history[0]).toMatchObject({
      userAlias: "FM",
      activeStudioMember: false,
      userName: "Former Member",
    });
  });

  test("lists candidates with their live studio identity", async () => {
    const response = await app().request(
      "/api/projects/project-1/assignment-candidates?search=CGP&page=1&pageSize=25",
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      candidates: [
        {
          userAlias: "CGP",
          activeStudioMember: true,
          name: "Cristian Granda Pastora",
        },
      ],
    });
  });

  test("adds several responsible members without accepting actor facts", async () => {
    const projectCollaboration = collaborationStub();
    const body = {
      assignments: [
        { userId: "user-2", responsibility: "responsible" },
        { userId: "user-3", responsibility: "responsible" },
      ],
    };
    const response = await app(projectCollaboration).request(
      "/api/projects/project-1/assignments",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
    );

    expect(response.status).toBe(201);
    expect(projectCollaboration.addAssignments).toHaveBeenCalledWith(
      actor,
      "project-1",
      body.assignments,
    );
  });

  test("lists structured project activity", async () => {
    const response = await app().request(
      "/api/projects/project-1/activities?page=1&pageSize=25",
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      activities: Array<Record<string, unknown>>;
    };
    expect(Object.keys(body.activities[0] ?? {}).sort()).toEqual([
      "actor",
      "createdAt",
      "details",
      "id",
      "subject",
      "type",
    ]);
    expect(body.activities[0]).toMatchObject({
      actor: {
        userId: "user-1",
        alias: "AT",
        nameSnapshot: "Ana Torres",
        activeStudioMember: true,
        linkable: true,
      },
      subject: {
        userId: "user-2",
        alias: null,
        nameSnapshot: "Luis Ramos",
        activeStudioMember: false,
        linkable: false,
      },
      createdAt: now.toISOString(),
    });
  });

  test("removes a studio member through the transactional service", async () => {
    const projectCollaboration = collaborationStub();
    const response = await app(projectCollaboration).request(
      "/api/team/members/member-2",
      { method: "DELETE" },
    );

    expect(response.status).toBe(200);
    expect(projectCollaboration.removeOrganizationMember).toHaveBeenCalledWith(
      actor,
      "member-2",
    );
  });

  test.each([
    ["FORBIDDEN", 403],
    ["NOT_FOUND", 404],
    ["VALIDATION_ERROR", 400],
    ["CONFLICT", 409],
    ["LAST_OWNER", 409],
  ] as const)("maps %s errors", async (code, status) => {
    const response = await app(
      collaborationStub({
        addAssignments: vi
          .fn()
          .mockRejectedValue(
            new ProjectCollaborationServiceError(code, "No disponible."),
          ),
      }),
    ).request("/api/projects/project-1/assignments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        assignments: [{ userId: "user-2", responsibility: "member" }],
      }),
    });

    expect(response.status).toBe(status);
    expect(await response.json()).toEqual({
      error: { code, message: "No disponible." },
    });
  });

  test("requires authentication and an active studio", async () => {
    const anonymous = await app(collaborationStub(), authStub(null)).request(
      "/api/projects/project-1/assignments",
    );
    const noStudio = await app(
      collaborationStub(),
      authStub({
        ...activeSession,
        session: { ...activeSession.session, activeOrganizationId: null },
      }),
    ).request("/api/team/members/member-2", { method: "DELETE" });

    expect(anonymous.status).toBe(401);
    expect(noStudio.status).toBe(409);
  });
});
