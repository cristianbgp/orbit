import { describe, expect, test, vi } from "vitest";

import type { AuthService, AuthSession } from "../src/auth/types";
import {
  createIdentityService,
  type IdentityService,
} from "../src/identity/identity-service";
import { createTestApp as createApp } from "./support/app";
import { testClientService } from "./support/client-service";
import { createTestIdentityService } from "./support/identity-service";
import { testProjectCollaborationService } from "./support/project-collaboration-service";
import { testProjectService } from "./support/project-service";
import { testProjectStageService } from "./support/project-stage-service";
import { testTeamInvitationService } from "./support/team-invitation-service";

function createAuthStub(session: AuthSession | null): AuthService {
  return {
    handler: async () => Response.json({ mounted: true }),
    getSession: async () => session,
  };
}

function createIdentityApp(
  session: AuthSession | null,
  identity: IdentityService = createTestIdentityService(),
) {
  return createApp({
    auth: createAuthStub(session),
    clients: testClientService,
    identity,
    projects: testProjectService,
    projectStages: testProjectStageService,
    projectCollaboration: testProjectCollaborationService,
    teamInvitations: testTeamInvitationService,
  });
}

const organizationSession: AuthSession = {
  user: { id: "user-1", name: "Cristian Granda", email: "cristian@orbit.pe" },
  session: { id: "session-1", activeOrganizationId: "org-1" },
};

describe("identity API", () => {
  test("accepts member search and professional-position filters", async () => {
    const listMembers = vi.fn(async () => ({
      members: [],
      pagination: { page: 1, pageSize: 25, total: 0, totalPages: 0 },
    }));
    const identity = {
      ...createTestIdentityService(),
      listMembers,
    } as unknown as IdentityService;
    const app = createIdentityApp(organizationSession, identity);

    expect(
      (
        await app.request(
          "/api/team/members?page=1&pageSize=25&q=cris&position=partner",
        )
      ).status,
    ).toBe(200);
    expect(listMembers).toHaveBeenCalledWith(
      { userId: "user-1", organizationId: "org-1" },
      { page: 1, pageSize: 25, q: "cris", position: "partner" },
    );
    expect(
      (await app.request("/api/team/members?position=director")).status,
    ).toBe(400);
  });

  test("updates a studio member position through the owner endpoint", async () => {
    const updateMemberPosition = async () => ({
      ...(await createTestIdentityService().getMember(
        { userId: "user-1", organizationId: "org-1" },
        "user-1",
      )),
      position: "partner" as const,
    });
    const identity = {
      ...createTestIdentityService(),
      updateMemberPosition,
    } as unknown as IdentityService;
    const app = createIdentityApp(organizationSession, identity);

    const response = await app.request("/api/team/members/member-1/position", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ position: "partner" }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      member: { memberId: "member-1", position: "partner" },
    });
  });

  test("returns and updates the authenticated current user profile", async () => {
    const app = createIdentityApp(organizationSession);

    expect((await app.request("/api/me")).status).toBe(200);
    expect(
      (
        await app.request("/api/me", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ alias: "CGP" }),
        })
      ).status,
    ).toBe(200);
    expect(
      await (await app.request("/api/team/members?page=1&pageSize=25")).json(),
    ).toMatchObject({ members: [expect.objectContaining({ alias: "CGP" })] });
    expect((await app.request("/api/team/users/user-1")).status).toBe(200);
  });

  test("keeps current-user and member aliases non-null while stored aliases are null", async () => {
    const storedUser = {
      id: "user-1",
      alias: null,
      avatarColor: null,
      name: "Cristian Granda",
      email: "cristian@orbit.pe",
      image: null,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
    };
    const storedMember = {
      memberId: "member-1",
      userId: "user-1",
      alias: null,
      avatarColor: null,
      name: "Cristian Granda",
      email: "cristian@orbit.pe",
      image: null,
      role: "owner",
      position: null,
      memberSince: new Date("2026-01-01T00:00:00.000Z"),
    };
    const identity = createIdentityService({
      hasMembership: async () => true,
      findUser: async () => storedUser,
      updateProfile: async (_userId, input) => ({ ...storedUser, ...input }),
      listMembers: async () => ({ members: [storedMember], total: 1 }),
      findMember: async () => storedMember,
      getMembershipRole: async () => "owner",
      updateMemberPosition: async (_organizationId, _memberId, position) => ({
        ...storedMember,
        position,
      }),
    });
    const app = createIdentityApp(organizationSession, identity);

    await expect((await app.request("/api/me")).json()).resolves.toMatchObject({
      user: { alias: "CG" },
    });
    await expect(
      (await app.request("/api/team/members")).json(),
    ).resolves.toMatchObject({
      members: [expect.objectContaining({ alias: "CG" })],
    });
    await expect(
      (await app.request("/api/team/users/user-1")).json(),
    ).resolves.toMatchObject({ member: { alias: "CG" } });
  });

  test("rejects anonymous identity requests", async () => {
    const app = createIdentityApp(null);

    expect((await app.request("/api/me")).status).toBe(401);
    expect((await app.request("/api/team/members")).status).toBe(401);
  });

  test("requires an active organization for studio members", async () => {
    const app = createIdentityApp({
      ...organizationSession,
      session: { id: "session-1", activeOrganizationId: null },
    });

    expect((await app.request("/api/team/members")).status).toBe(409);
    expect((await app.request("/api/team/users/user-1")).status).toBe(409);
  });

  test("keeps current-user profile access independent of an active organization", async () => {
    const app = createIdentityApp({
      ...organizationSession,
      session: { id: "session-1", activeOrganizationId: null },
    });

    expect((await app.request("/api/me")).status).toBe(200);
    expect(
      (
        await app.request("/api/me", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ alias: "CGP" }),
        })
      ).status,
    ).toBe(200);
  });

  test("rejects a stale active organization without exposing members", async () => {
    const app = createIdentityApp({
      ...organizationSession,
      user: {
        id: "user-2",
        name: "External User",
        email: "external@orbit.pe",
      },
    });

    expect((await app.request("/api/team/members")).status).toBe(403);
    expect((await app.request("/api/team/users/user-1")).status).toBe(403);
  });

  test("rejects an invalid alias", async () => {
    const app = createIdentityApp(organizationSession);

    const response = await app.request("/api/me", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ alias: "A-B" }),
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      error: { code: "VALIDATION_ERROR" },
    });
  });

  test("updates only the authenticated user's accessible palette color", async () => {
    const app = createIdentityApp(organizationSession);

    const response = await app.request("/api/me", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ avatarColor: "#4657d9" }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      user: { id: "user-1", avatarColor: "#4657d9" },
    });
  });

  test("rejects arbitrary avatar colors", async () => {
    const app = createIdentityApp(organizationSession);

    const response = await app.request("/api/me", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ avatarColor: "#ffffff" }),
    });

    expect(response.status).toBe(400);
  });

  test("hides missing and cross-tenant members", async () => {
    const app = createIdentityApp(organizationSession);

    expect((await app.request("/api/team/users/missing")).status).toBe(404);
    expect((await app.request("/api/team/users/user-2")).status).toBe(404);
  });
});
