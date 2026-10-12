import { describe, expect, test, vi } from "vitest";

import type { AuthService, AuthSession } from "../src/auth/types";
import type { RateLimiter } from "../src/rate-limit/rate-limit-types";
import { createInMemoryRateLimiter } from "../src/rate-limit/in-memory-rate-limiter";
import { createTestApp as createApp } from "./support/app";
import { testClientService } from "./support/client-service";
import { testProjectCollaborationService } from "./support/project-collaboration-service";
import { testProjectService } from "./support/project-service";
import { testProjectStageService } from "./support/project-stage-service";
import { testTeamInvitationService } from "./support/team-invitation-service";

const activeSession: AuthSession = {
  user: { id: "user-1", name: "Cristian", email: "user@orbit.pe" },
  session: { id: "session-1", activeOrganizationId: "org-1" },
};

function createAuthStub(session: AuthSession | null): AuthService {
  return {
    handler: async () => Response.json({ mounted: true }),
    getSession: async () => session,
  };
}

function createAppWith(options: {
  session: AuthSession | null;
  rateLimiter: RateLimiter;
  clients?: typeof testClientService;
  apiDocsEnabled?: boolean;
}) {
  return createApp({
    auth: createAuthStub(options.session),
    rateLimiter: options.rateLimiter,
    apiDocsEnabled: options.apiDocsEnabled,
    clients: options.clients ?? testClientService,
    projects: testProjectService,
    projectStages: testProjectStageService,
    teamInvitations: testTeamInvitationService,
    projectCollaboration: testProjectCollaborationService,
  });
}

describe("authenticated API rate limiting", () => {
  test("does not consume allowance before rejecting an anonymous request", async () => {
    const consume = vi.fn(() => ({ allowed: true }) as const);
    const app = createAppWith({
      session: null,
      rateLimiter: { consume },
    });

    expect((await app.request("/api/clients")).status).toBe(401);
    expect(consume).not.toHaveBeenCalled();
  });

  test("does not consume allowance before requiring an active organization", async () => {
    const consume = vi.fn(() => ({ allowed: true }) as const);
    const app = createAppWith({
      session: {
        ...activeSession,
        session: { ...activeSession.session, activeOrganizationId: null },
      },
      rateLimiter: { consume },
    });

    expect((await app.request("/api/clients")).status).toBe(409);
    expect(consume).not.toHaveBeenCalled();
  });

  test("shares one authenticated user allowance across identity and organization routes", async () => {
    const app = createAppWith({
      session: activeSession,
      rateLimiter: createInMemoryRateLimiter({
        limit: 1,
        now: () => 1_000,
      }),
    });

    expect((await app.request("/api/me")).status).toBe(200);
    const response = await app.request("/api/clients");

    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("60");
    expect(await response.json()).toEqual({
      error: {
        code: "RATE_LIMITED",
        message:
          "Has realizado demasiadas solicitudes. Inténtalo nuevamente en un momento.",
        retryAfterSeconds: 60,
      },
    });
  });

  test("does not invoke the route service after rejecting a request", async () => {
    const list = vi.fn().mockResolvedValue({
      clients: [],
      pagination: { page: 1, pageSize: 25, total: 0, totalPages: 0 },
    });
    const app = createAppWith({
      session: activeSession,
      rateLimiter: {
        consume: () => ({ allowed: false, retryAfterSeconds: 18 }),
      },
      clients: {
        ...testClientService,
        list,
      },
    });

    const response = await app.request("/api/clients");

    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("18");
    expect(list).not.toHaveBeenCalled();
  });

  test.each([
    ["/health", false],
    ["/api/auth/session", false],
    ["/openapi.json", true],
    ["/docs", true],
  ])("does not limit the excluded route %s", async (path, apiDocsEnabled) => {
    const consume = vi.fn(
      () =>
        ({
          allowed: false,
          retryAfterSeconds: 60,
        }) as const,
    );
    const app = createAppWith({
      session: activeSession,
      rateLimiter: { consume },
      apiDocsEnabled,
    });

    expect((await app.request(path)).status).toBe(200);
    expect(consume).not.toHaveBeenCalled();
  });
});
