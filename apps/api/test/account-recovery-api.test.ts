import { describe, expect, test, vi } from "vitest";

import type { AuthService, AuthSession } from "../src/auth/types";
import {
  AccountRecoveryServiceError,
  type AccountRecoveryService,
} from "../src/account-recovery/account-recovery-service";
import { createTestApp } from "./support/app";
import { testClientService } from "./support/client-service";
import { testProjectCollaborationService } from "./support/project-collaboration-service";
import { testProjectService } from "./support/project-service";
import { testProjectStageService } from "./support/project-stage-service";
import { testTeamInvitationService } from "./support/team-invitation-service";

const organizationSession: AuthSession = {
  user: { id: "owner-1", name: "Olivia Owner", email: "owner@orbit.pe" },
  session: { id: "session-1", activeOrganizationId: "org-1" },
};

function auth(session: AuthSession | null): AuthService {
  return {
    handler: async () => Response.json({ mounted: true }),
    getSession: async () => session,
  };
}

function recoveryService(
  generateForMember: AccountRecoveryService["generateForMember"],
): AccountRecoveryService {
  return {
    generateForMember,
    generateOperationally: vi.fn(),
    recordCompletion: vi.fn(),
  };
}

function app(
  session: AuthSession | null,
  accountRecovery: AccountRecoveryService,
) {
  return createTestApp({
    auth: auth(session),
    clients: testClientService,
    projects: testProjectService,
    projectStages: testProjectStageService,
    projectCollaboration: testProjectCollaborationService,
    teamInvitations: testTeamInvitationService,
    accountRecovery,
  } as Parameters<typeof createTestApp>[0] & {
    accountRecovery: AccountRecoveryService;
  });
}

const path = "/api/team/users/user-2/password-recovery-link";

describe("account recovery API", () => {
  test("rejects anonymous access and sessions without an active organization", async () => {
    const service = recoveryService(vi.fn());

    expect(
      (await app(null, service).request(path, { method: "POST" })).status,
    ).toBe(401);
    expect(
      (
        await app(
          {
            ...organizationSession,
            session: { id: "session-1", activeOrganizationId: null },
          },
          service,
        ).request(path, { method: "POST" })
      ).status,
    ).toBe(409);
    expect(service.generateForMember).not.toHaveBeenCalled();
  });

  test.each([
    [
      new AccountRecoveryServiceError(
        "FORBIDDEN",
        "Solo el propietario puede generar enlaces de recuperación.",
      ),
      403,
    ],
    [
      new AccountRecoveryServiceError("NOT_FOUND", "Miembro no encontrado."),
      404,
    ],
    [
      new AccountRecoveryServiceError(
        "UNAVAILABLE",
        "No pudimos generar el enlace de recuperación.",
      ),
      503,
    ],
  ])("maps %s to HTTP %s", async (error, status) => {
    const service = recoveryService(vi.fn().mockRejectedValue(error));

    const response = await app(organizationSession, service).request(path, {
      method: "POST",
    });

    expect(response.status).toBe(status);
    await expect(response.json()).resolves.toEqual({
      error: { code: error.code, message: error.message },
    });
  });

  test("returns one non-cacheable owner-generated recovery link", async () => {
    const generateForMember = vi.fn().mockResolvedValue({
      url: "https://app.orbit.pe/reset-password?token=secret",
      expiresAt: new Date("2026-08-18T15:30:00.000Z"),
    });
    const service = recoveryService(generateForMember);

    const response = await app(organizationSession, service).request(path, {
      method: "POST",
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store, private");
    await expect(response.json()).resolves.toEqual({
      url: "https://app.orbit.pe/reset-password?token=secret",
      expiresAt: "2026-08-18T15:30:00.000Z",
    });
    expect(generateForMember).toHaveBeenCalledWith(
      { userId: "owner-1", organizationId: "org-1" },
      "user-2",
    );
  });
});
