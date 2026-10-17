import { describe, expect, test, vi } from "vitest";

import { createTestApp as createApp } from "./support/app";
import type { AuthService, AuthSession } from "../src/auth/types";
import {
  TeamInvitationServiceError,
  type TeamInvitationService,
} from "../src/team-invitations/team-invitation-service";
import { testClientService } from "./support/client-service";
import { testProjectService } from "./support/project-service";
import { testProjectStageService } from "./support/project-stage-service";
import { testProjectCollaborationService } from "./support/project-collaboration-service";

const session: AuthSession = {
  user: { id: "owner-1", name: "Ana", email: "ana@orbit.pe" },
  session: { id: "session-1", activeOrganizationId: "org-1" },
};

function authWith(current: AuthSession | null): AuthService {
  return {
    handler: async () => new Response(null, { status: 404 }),
    getSession: async () => current,
  };
}

function createTestApp(
  auth: AuthService,
  teamInvitations: TeamInvitationService,
) {
  return createApp({
    auth,
    clients: testClientService,
    projects: testProjectService,
    projectStages: testProjectStageService,
    teamInvitations,
    projectCollaboration: testProjectCollaborationService,
  });
}

describe("team invitations API", () => {
  test("returns owner-visible pending invitations", async () => {
    const listPending = vi.fn().mockResolvedValue([
      {
        id: "invitation-1",
        email: "member@orbit.pe",
        role: "member",
        position: "senior",
        status: "pending",
        createdAt: new Date("2026-08-06T10:00:00.000Z"),
        expiresAt: new Date("2026-08-08T10:00:00.000Z"),
      },
    ]);
    const response = await createTestApp(authWith(session), {
      listPending,
    }).request("/api/team/invitations");

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      invitations: [
        {
          id: "invitation-1",
          email: "member@orbit.pe",
          role: "member",
          position: "senior",
          status: "pending",
          createdAt: "2026-08-06T10:00:00.000Z",
          expiresAt: "2026-08-08T10:00:00.000Z",
        },
      ],
    });
    expect(listPending).toHaveBeenCalledWith({
      userId: "owner-1",
      organizationId: "org-1",
    });
  });

  test("rejects anonymous access", async () => {
    const response = await createTestApp(authWith(null), {
      listPending: vi.fn(),
    }).request("/api/team/invitations");

    expect(response.status).toBe(401);
  });

  test("requires an active organization", async () => {
    const response = await createTestApp(
      authWith({
        ...session,
        session: { ...session.session, activeOrganizationId: null },
      }),
      { listPending: vi.fn() },
    ).request("/api/team/invitations");

    expect(response.status).toBe(409);
  });

  test("maps non-owner access to a Spanish forbidden response", async () => {
    const response = await createTestApp(authWith(session), {
      listPending: vi
        .fn()
        .mockRejectedValue(
          new TeamInvitationServiceError("FORBIDDEN", "internal"),
        ),
    }).request("/api/team/invitations");

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({
      error: {
        code: "FORBIDDEN",
        message: "No puedes ver las invitaciones de este estudio.",
      },
    });
  });
});
