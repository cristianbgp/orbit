import { describe, expect, test, vi } from "vitest";

import { createApp } from "../src/app";
import type { AuthService, AuthSession } from "../src/auth/types";
import { FeatureFlagServiceError } from "../src/feature-flags/feature-flag-service";
import type { FeatureFlagService } from "../src/feature-flags/feature-flag-types";
import {
  HelpAssistantServiceError,
  type HelpAssistantService,
} from "../src/help-assistant/help-assistant-service";
import { testClientService } from "./support/client-service";
import { testDashboardService } from "./support/dashboard-service";
import { testIdentityService } from "./support/identity-service";
import { testMyWorkService } from "./support/my-work-service";
import { testProjectCollaborationService } from "./support/project-collaboration-service";
import { testProjectEventService } from "./support/project-event-service";
import { testProjectService } from "./support/project-service";
import { testProjectStageService } from "./support/project-stage-service";
import { testProjectTaskService } from "./support/project-task-service";
import { testSearchService } from "./support/search-service";
import { testTeamInvitationService } from "./support/team-invitation-service";
import { testAccountRecoveryService } from "./support/account-recovery-service";

function auth(
  session:
    | (AuthSession & {
        session: AuthSession["session"] & {
          activeOrganizationId: string | null;
        };
      })
    | null,
): AuthService {
  return {
    handler: async () => new Response(null, { status: 404 }),
    getSession: async () => session,
  };
}

const session = {
  user: { id: "user-1", name: "Ana", email: "ana@orbit.test" },
  session: { id: "session-1", activeOrganizationId: "org-1" },
};

function featureFlags(
  assertEnabled: FeatureFlagService["assertEnabled"] = vi.fn(),
): FeatureFlagService {
  return {
    resolveForActor: vi.fn().mockResolvedValue({ orbitHelpAssistant: true }),
    isEnabled: vi.fn().mockResolvedValue(true),
    assertEnabled,
  };
}

function app(
  options: {
    auth?: AuthService;
    featureFlags?: FeatureFlagService;
    helpAssistant?: HelpAssistantService;
  } = {},
) {
  return createApp({
    auth: options.auth ?? auth(session),
    accountRecovery: testAccountRecoveryService,
    featureFlags: options.featureFlags ?? featureFlags(),
    helpAssistant: options.helpAssistant ?? {
      ask: vi.fn().mockResolvedValue({
        answer: "La fecha final cierra el periodo planificado.",
        sources: [{ document: "04-modelo-dominio.md", section: "Project" }],
      }),
    },
    clients: testClientService,
    dashboard: testDashboardService,
    identity: testIdentityService,
    myWork: testMyWorkService,
    projects: testProjectService,
    projectEvents: testProjectEventService,
    projectStages: testProjectStageService,
    projectCollaboration: testProjectCollaborationService,
    projectTasks: testProjectTaskService,
    search: testSearchService,
    teamInvitations: testTeamInvitationService,
  });
}

function ask(
  target: ReturnType<typeof app>,
  question = "¿Qué es la fecha final?",
) {
  return target.request("/api/help/ask", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question }),
  });
}

describe("Orbit help assistant API", () => {
  test("requires authentication and an active organization", async () => {
    expect((await ask(app({ auth: auth(null) }))).status).toBe(401);
    expect(
      (
        await ask(
          app({
            auth: auth({
              ...session,
              session: { ...session.session, activeOrganizationId: null },
            }),
          }),
        )
      ).status,
    ).toBe(409);
  });

  test("rejects a disabled organization before assistant work", async () => {
    const assistant = { ask: vi.fn() };
    const disabledApp = app({
      featureFlags: featureFlags(
        vi
          .fn()
          .mockRejectedValue(
            new FeatureFlagServiceError(
              "FEATURE_DISABLED",
              "Esta función no está habilitada para este estudio.",
            ),
          ),
      ),
      helpAssistant: assistant,
    });
    const response = await ask(disabledApp);
    const invalidResponse = await ask(disabledApp, " ");

    expect(response.status).toBe(403);
    expect(invalidResponse.status).toBe(403);
    expect(assistant.ask).not.toHaveBeenCalled();
  });

  test("returns an answer with server-derived sources", async () => {
    const flags = featureFlags();
    const assistant = {
      ask: vi.fn().mockResolvedValue({
        answer: "La fecha final cierra el periodo planificado.",
        sources: [{ document: "04-modelo-dominio.md", section: "Project" }],
      }),
    };
    const response = await ask(
      app({ featureFlags: flags, helpAssistant: assistant }),
    );

    expect(response.status).toBe(200);
    expect(flags.assertEnabled).toHaveBeenCalledWith(
      "org-1",
      "orbit_help_assistant",
    );
    expect(assistant.ask).toHaveBeenCalledWith(
      { userId: "user-1", organizationId: "org-1" },
      "¿Qué es la fecha final?",
    );
    expect(await response.json()).toEqual({
      answer: "La fecha final cierra el periodo planificado.",
      sources: [{ document: "04-modelo-dominio.md", section: "Project" }],
    });
  });

  test.each([
    ["HELP_RATE_LIMITED", 429],
    ["HELP_PROVIDER_UNAVAILABLE", 503],
  ] as const)(
    "maps %s without exposing provider internals",
    async (code, status) => {
      const response = await ask(
        app({
          helpAssistant: {
            ask: vi
              .fn()
              .mockRejectedValue(
                new HelpAssistantServiceError(
                  code,
                  "Mensaje público controlado.",
                ),
              ),
          },
        }),
      );
      expect(response.status).toBe(status);
      expect(await response.json()).toEqual({
        error: { code, message: "Mensaje público controlado." },
      });
    },
  );

  test("validates the trimmed question contract", async () => {
    expect((await ask(app(), " ")).status).toBe(400);
    expect((await ask(app(), "a".repeat(501))).status).toBe(400);
  });
});
