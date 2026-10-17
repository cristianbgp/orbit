import { describe, expect, test } from "vitest";

import { createApp } from "../src/app";
import type { AuthService } from "../src/auth/types";
import { UserAliasSchema } from "../src/contracts/identity";
import {
  ProjectTaskInputSchema,
  ProjectTaskUpdateSchema,
} from "../src/contracts/project-tasks";
import { testClientService } from "./support/client-service";
import { testProjectService } from "./support/project-service";
import { testProjectStageService } from "./support/project-stage-service";
import { testTeamInvitationService } from "./support/team-invitation-service";
import { testProjectCollaborationService } from "./support/project-collaboration-service";
import { testProjectTaskService } from "./support/project-task-service";
import { testIdentityService } from "./support/identity-service";
import { testDashboardService } from "./support/dashboard-service";
import { testMyWorkService } from "./support/my-work-service";
import { testProjectEventService } from "./support/project-event-service";
import { testSearchService } from "./support/search-service";
import { testFeatureFlagService } from "./support/feature-flag-service";
import { testAccountRecoveryService } from "./support/account-recovery-service";

type OpenApiOperation = {
  operationId?: string;
  parameters?: Array<{
    name?: string;
    schema?: Record<string, unknown>;
  }>;
  responses?: Record<string, unknown>;
  security?: Array<Record<string, unknown[]>>;
  requestBody?: {
    content?: Record<string, { schema?: unknown }>;
  };
};

type OpenApiDocument = {
  openapi: string;
  info: { title: string; version: string };
  components?: {
    schemas?: Record<string, unknown>;
  };
  paths?: Record<
    string,
    {
      get?: OpenApiOperation;
      post?: OpenApiOperation;
      patch?: OpenApiOperation;
      put?: OpenApiOperation;
      delete?: OpenApiOperation;
    }
  >;
};

const anonymousAuth: AuthService = {
  handler: async () => new Response(null, { status: 404 }),
  getSession: async () => null,
};

describe("Orbit OpenAPI documentation", () => {
  test("describes task deadlines without the retired internal-deadline language", () => {
    const createResult = ProjectTaskInputSchema.safeParse({
      title: "Preparar informe",
      stageId: "stage-1",
      internalDueDate: "2026-08-20",
    });
    const updateResult = ProjectTaskUpdateSchema.safeParse({
      plannedStartDate: null,
      internalDueDate: "2026-08-20",
    });

    expect(createResult.error?.issues[0]?.message).toBe(
      "Selecciona un inicio planificado para usar una fecha límite.",
    );
    expect(updateResult.error?.issues[0]?.message).toBe(
      "Selecciona un inicio planificado para usar una fecha límite.",
    );
  });

  test("validates alias length by Unicode code point after normalization", () => {
    const sevenAstralLetters = "𐐀𐐁𐐂𐐃𐐄𐐅𐐆";

    expect(UserAliasSchema.safeParse("𐐀").success).toBe(false);
    expect(UserAliasSchema.parse(sevenAstralLetters)).toBe(sevenAstralLetters);
    expect(UserAliasSchema.parse("  ÁG2  ")).toBe("ÁG2");
  });

  test("does not expose documentation without an explicit opt-in", async () => {
    const app = createApp({
      auth: anonymousAuth,
      accountRecovery: testAccountRecoveryService,
      featureFlags: testFeatureFlagService,
      search: testSearchService,
      identity: testIdentityService,
      clients: testClientService,
      projects: testProjectService,
      projectEvents: testProjectEventService,
      projectStages: testProjectStageService,
      teamInvitations: testTeamInvitationService,
      projectCollaboration: testProjectCollaborationService,
      projectTasks: testProjectTaskService,
      dashboard: testDashboardService,
      myWork: testMyWorkService,
    });

    expect((await app.request("/openapi.json")).status).toBe(404);
    expect((await app.request("/docs")).status).toBe(404);
  });

  test("serves only the application contract when enabled", async () => {
    const app = createApp({
      auth: anonymousAuth,
      accountRecovery: testAccountRecoveryService,
      featureFlags: testFeatureFlagService,
      apiDocsEnabled: true,
      search: testSearchService,
      identity: testIdentityService,
      clients: testClientService,
      projects: testProjectService,
      projectEvents: testProjectEventService,
      projectStages: testProjectStageService,
      teamInvitations: testTeamInvitationService,
      projectCollaboration: testProjectCollaborationService,
      projectTasks: testProjectTaskService,
      dashboard: testDashboardService,
      myWork: testMyWorkService,
    });
    const response = await app.request("/openapi.json");
    const document = (await response.json()) as OpenApiDocument;

    expect(response.status).toBe(200);
    expect(document.openapi).toBe("3.1.0");
    expect(document.info).toEqual({ title: "Orbit API", version: "0.1.0" });
    expect(document.components?.schemas?.UserAlias).toEqual({
      type: "string",
      minLength: 2,
      maxLength: 12,
      pattern: "^[\\p{L}\\p{N}]+$",
    });
    expect(document.components?.schemas?.RateLimitedError).toMatchObject({
      type: "object",
      required: ["error"],
      properties: {
        error: {
          type: "object",
          required: ["code", "message", "retryAfterSeconds"],
          properties: {
            code: { type: "string" },
            message: { type: "string" },
            retryAfterSeconds: {
              type: "integer",
              minimum: 1,
            },
          },
        },
      },
    });
    expect(Object.keys(document.paths ?? {})).toEqual([
      "/health",
      "/api/me",
      "/api/dashboard/activity",
      "/api/my-work/tasks",
      "/api/my-work/supervision",
      "/api/my-work/case-actions",
      "/api/search",
      "/api/features",
      "/api/help/ask",
      "/api/cases/options",
      "/api/cases",
      "/api/cases/grouped-by-client",
      "/api/cases/presentation",
      "/api/cases/{caseId}",
      "/api/cases/{caseId}/archive",
      "/api/cases/{caseId}/restore",
      "/api/cases/{caseId}/assignments",
      "/api/cases/{caseId}/assignments/candidates",
      "/api/cases/{caseId}/assignments/{assignmentId}/end",
      "/api/cases/{caseId}/activity",
      "/api/cases/{caseId}/updates",
      "/api/cases/{caseId}/updates/{updateId}",
      "/api/cases/{caseId}/updates/{updateId}/archive",
      "/api/cases/{caseId}/updates/{updateId}/restore",
      "/api/cases/updates/move-to-background",
      "/api/cases/updates/move-to-background/preview",
      "/api/cases/{caseId}/actions",
      "/api/cases/{caseId}/actions/{actionId}",
      "/api/cases/{caseId}/actions/{actionId}/complete",
      "/api/cases/{caseId}/actions/{actionId}/reopen",
      "/api/cases/{caseId}/actions/{actionId}/archive",
      "/api/cases/{caseId}/actions/{actionId}/restore",
      "/api/case-events/calendar",
      "/api/cases/{caseId}/events",
      "/api/cases/{caseId}/events/{eventId}",
      "/api/clients",
      "/api/team/members",
      "/api/team/users/{userId}",
      "/api/team/users/{userId}/password-recovery-link",
      "/api/team/members/{memberId}/position",
      "/api/clients/{clientId}",
      "/api/projects",
      "/api/projects/grouped-by-client",
      "/api/projects/{projectId}",
      "/api/projects/{projectId}/archive",
      "/api/projects/{projectId}/restore",
      "/api/projects/{projectId}/events",
      "/api/projects/{projectId}/events/{eventId}",
      "/api/projects/{projectId}/stages",
      "/api/projects/{projectId}/stages/{stageId}",
      "/api/projects/{projectId}/stages/order",
      "/api/projects/{projectId}/tasks",
      "/api/project-tasks/calendar",
      "/api/project-tasks/undated",
      "/api/projects/{projectId}/task-schedule",
      "/api/projects/{projectId}/tasks/{taskId}",
      "/api/projects/{projectId}/tasks/{taskId}/responsibles",
      "/api/projects/{projectId}/tasks/{taskId}/archive",
      "/api/projects/{projectId}/tasks/{taskId}/restore",
      "/api/projects/{projectId}/assignments",
      "/api/projects/{projectId}/assignment-candidates",
      "/api/projects/{projectId}/assignments/{assignmentId}",
      "/api/projects/{projectId}/activities",
      "/api/team/members/{memberId}",
      "/api/team/invitations",
    ]);
    expect(document.paths?.["/health"]?.get?.operationId).toBe("getHealth");
    expect(document.paths?.["/api/me"]?.get?.operationId).toBe(
      "getCurrentUser",
    );
    expect(document.paths?.["/api/me"]?.get?.responses).toHaveProperty("401");
    expect(document.paths?.["/api/me"]?.get?.security).toEqual([
      { sessionCookie: [] },
    ]);
    expect(document.paths?.["/api/me"]?.patch?.operationId).toBe(
      "updateCurrentUser",
    );
    expect(document.paths?.["/api/me"]?.patch?.security).toEqual([
      { sessionCookie: [] },
    ]);
    expect(
      document.paths?.["/api/cases/{caseId}/updates"]?.get?.operationId,
    ).toBe("listCaseUpdates");
    expect(
      document.paths?.["/api/cases/{caseId}/updates"]?.post?.operationId,
    ).toBe("createCaseUpdate");
    expect(
      document.paths?.["/api/cases/{caseId}/updates/{updateId}"]?.patch
        ?.operationId,
    ).toBe("updateCaseUpdate");
    expect(
      document.paths?.["/api/cases/updates/move-to-background"]?.post
        ?.operationId,
    ).toBe("moveCaseUpdatesToBackground");
    expect(
      document.paths?.["/api/cases/updates/move-to-background/preview"]?.get
        ?.operationId,
    ).toBe("previewMoveCaseUpdatesToBackground");
    const caseEventPath = document.paths?.["/api/cases/{caseId}/events"];
    const caseEventDetailPath =
      document.paths?.["/api/cases/{caseId}/events/{eventId}"];
    expect(
      JSON.stringify(caseEventPath?.get?.responses?.["409"]),
    ).not.toContain("CONFLICT");
    expect(
      JSON.stringify(caseEventPath?.post?.responses?.["409"]),
    ).not.toContain("CONFLICT");
    expect(
      JSON.stringify(caseEventDetailPath?.patch?.responses?.["409"]),
    ).toContain("CONFLICT");
    expect(
      JSON.stringify(caseEventDetailPath?.delete?.responses?.["409"]),
    ).toContain("CONFLICT");

    for (const [path, pathItem] of Object.entries(document.paths ?? {})) {
      for (const method of ["get", "post", "patch", "put", "delete"] as const) {
        const operation = pathItem[method];
        const usesSession = operation?.security?.some(
          (requirement) => "sessionCookie" in requirement,
        );
        if (usesSession) {
          expect(
            operation?.responses,
            `${method.toUpperCase()} ${path}`,
          ).toHaveProperty("429");
        }
      }
    }
    expect(
      document.paths?.["/api/team/users/{userId}/password-recovery-link"]?.post,
    ).toMatchObject({
      operationId: "createMemberPasswordRecoveryLink",
      security: [{ sessionCookie: [] }],
    });
    expect(document.paths).not.toHaveProperty("/api/dashboard/overview");
    expect(document.paths?.["/api/my-work/tasks"]?.get?.operationId).toBe(
      "listMyAssignedTasks",
    );
    expect(document.paths?.["/api/my-work/supervision"]?.get?.operationId).toBe(
      "listMySupervision",
    );
    expect(document.paths?.["/api/search"]?.get).toMatchObject({
      operationId: "searchGlobally",
      security: [{ sessionCookie: [] }],
      parameters: expect.arrayContaining([
        {
          name: "q",
          in: "query",
          required: true,
          schema: expect.objectContaining({
            type: "string",
            minLength: 2,
            maxLength: 160,
          }),
        },
        {
          name: "limit",
          in: "query",
          required: false,
          schema: expect.objectContaining({
            type: "integer",
            minimum: 1,
            maximum: 10,
            default: 5,
          }),
        },
      ]),
    });
    expect(document.paths?.["/api/features"]?.get).toMatchObject({
      operationId: "getFeatureFlags",
      security: [{ sessionCookie: [] }],
      responses: {
        "200": expect.any(Object),
        "401": expect.any(Object),
        "403": expect.any(Object),
        "409": expect.any(Object),
      },
    });
    expect(document.paths?.["/api/help/ask"]?.post).toMatchObject({
      operationId: "askOrbitHelp",
      security: [{ sessionCookie: [] }],
      responses: {
        "200": expect.any(Object),
        "400": expect.any(Object),
        "401": expect.any(Object),
        "403": expect.any(Object),
        "409": expect.any(Object),
        "429": expect.any(Object),
        "503": expect.any(Object),
      },
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/OrbitHelpQuestion" },
          },
        },
      },
    });
    expect(document.components?.schemas?.OrbitHelpQuestion).toMatchObject({
      required: ["question"],
      properties: {
        question: expect.objectContaining({ minLength: 2, maxLength: 500 }),
      },
    });
    expect(document.components?.schemas?.GlobalSearchResponse).toMatchObject({
      required: ["cases", "projects", "tasks", "clients", "members"],
    });
    expect(document.components?.schemas?.MyWorkTask).toMatchObject({
      required: expect.arrayContaining([
        "id",
        "group",
        "project",
        "stage",
        "responsibles",
      ]),
      properties: {
        group: {
          type: "string",
          enum: [
            "overdue",
            "today",
            "this_week",
            "future",
            "undated",
            "completed",
          ],
        },
      },
    });
    expect(document.components?.schemas?.MySupervisedProject).toMatchObject({
      properties: {
        counts: {
          required: [
            "pending",
            "inProgress",
            "blocked",
            "completed",
            "unassigned",
            "total",
          ],
        },
      },
    });
    expect(
      document.components?.schemas?.ProjectTeamMemberSummary,
    ).toMatchObject({
      required: expect.arrayContaining(["position"]),
      properties: expect.objectContaining({ position: expect.any(Object) }),
    });
    expect(document.components?.schemas?.TaskResponsible).toMatchObject({
      required: expect.arrayContaining(["userPosition"]),
      properties: expect.objectContaining({ userPosition: expect.any(Object) }),
    });
    expect(document.components?.schemas).not.toHaveProperty(
      "DashboardOverview",
    );
    expect(document.components?.schemas?.DashboardActivityPage).toMatchObject({
      required: ["timeZone", "activities", "nextCursor"],
      properties: expect.objectContaining({
        activities: expect.objectContaining({ type: "array", maxItems: 50 }),
        nextCursor: expect.objectContaining({ type: ["string", "null"] }),
      }),
    });
    expect(
      document.paths?.["/api/me"]?.patch?.requestBody?.content?.[
        "application/json"
      ]?.schema,
    ).toMatchObject({
      type: "object",
      properties: {
        alias: expect.any(Object),
        avatarColor: expect.any(Object),
      },
    });
    expect(
      Object.keys(
        (
          document.paths?.["/api/me"]?.patch?.requestBody?.content?.[
            "application/json"
          ]?.schema as { properties?: Record<string, unknown> }
        )?.properties ?? {},
      ),
    ).toEqual(["alias", "avatarColor"]);
    expect(document.paths?.["/api/team/members"]?.get?.operationId).toBe(
      "listTeamMembers",
    );
    expect(
      document.paths?.["/api/team/members"]?.get?.responses,
    ).toHaveProperty("403");
    expect(document.paths?.["/api/team/users/{userId}"]?.get?.operationId).toBe(
      "getTeamMember",
    );
    expect(
      document.paths?.["/api/team/users/{userId}"]?.get?.responses,
    ).toHaveProperty("403");
    expect(JSON.stringify(document)).not.toContain("/api/auth");
    expect(document.paths?.["/api/clients"]?.get?.operationId).toBe(
      "listClients",
    );
    expect(document.paths?.["/api/clients"]?.post?.operationId).toBe(
      "createClient",
    );
    expect(document.paths?.["/api/clients/{clientId}"]?.get?.operationId).toBe(
      "getClient",
    );
    expect(
      document.paths?.["/api/clients/{clientId}"]?.patch?.operationId,
    ).toBe("updateClient");
    expect(document.paths?.["/api/clients"]?.get?.security).toEqual([
      { sessionCookie: [] },
    ]);
    expect(document.paths?.["/api/clients"]?.get?.parameters).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "page",
          schema: expect.objectContaining({ default: 1, minimum: 1 }),
        }),
        expect.objectContaining({
          name: "pageSize",
          schema: expect.objectContaining({
            default: 25,
            minimum: 1,
            maximum: 100,
          }),
        }),
      ]),
    );
    expect(JSON.stringify(document)).toContain('"pagination"');
    expect(document.components?.schemas?.ProjectTaskScheduleResponse).toEqual(
      expect.objectContaining({
        properties: expect.objectContaining({
          project: expect.objectContaining({
            properties: expect.objectContaining({
              timeZone: { type: "string", minLength: 1 },
            }),
          }),
        }),
      }),
    );
    expect(
      (
        document.components?.schemas?.ProjectTaskCalendarContext as {
          properties?: Record<string, unknown>;
        }
      )?.properties?.plannedStartDate,
    ).toEqual({ type: "string", format: "date" });
    expect(
      (
        document.components?.schemas?.UndatedProjectTaskContext as {
          properties?: Record<string, unknown>;
        }
      )?.properties?.plannedStartDate,
    ).toEqual({ type: "null" });
    expect(document.paths?.["/api/projects"]?.get?.operationId).toBe(
      "listProjects",
    );
    expect(
      document.paths?.["/api/projects/grouped-by-client"]?.get?.operationId,
    ).toBe("listProjectsGroupedByClient");
    expect(document.paths?.["/api/projects"]?.post?.operationId).toBe(
      "createProject",
    );
    expect(document.paths?.["/api/projects/calendar"]).toBeUndefined();
    expect(
      document.paths?.["/api/projects/{projectId}"]?.get?.operationId,
    ).toBe("getProject");
    expect(
      document.paths?.["/api/projects/{projectId}"]?.patch?.operationId,
    ).toBe("updateProject");
    expect(document.paths?.["/api/projects"]?.get?.security).toEqual([
      { sessionCookie: [] },
    ]);
    expect(document.paths?.["/api/projects"]?.get?.parameters).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "type" }),
        expect.objectContaining({ name: "status" }),
        expect.objectContaining({ name: "page" }),
        expect.objectContaining({ name: "pageSize" }),
      ]),
    );
    expect(document.paths?.["/api/projects"]?.delete).toBeUndefined();
    expect(
      document.paths?.["/api/projects/{projectId}"]?.delete,
    ).toBeUndefined();
    expect(JSON.stringify(document)).toContain('"consultation"');
    expect(JSON.stringify(document)).toContain('"oral_argument"');
    expect(JSON.stringify(document)).toContain('"ProjectPagination"');
    expect(
      document.paths?.["/api/projects/{projectId}/stages"]?.get?.operationId,
    ).toBe("listProjectStages");
    expect(
      document.paths?.["/api/projects/{projectId}/stages"]?.post?.operationId,
    ).toBe("createProjectStage");
    expect(
      document.paths?.["/api/projects/{projectId}/stages/order"]?.put
        ?.operationId,
    ).toBe("reorderProjectStages");
    expect(
      document.paths?.["/api/projects/{projectId}/stages/{stageId}"]?.patch
        ?.operationId,
    ).toBe("updateProjectStage");
    expect(
      document.paths?.["/api/projects/{projectId}/stages/{stageId}"]?.delete,
    ).toBeDefined();
    expect(
      document.paths?.["/api/projects/{projectId}/tasks"]?.get?.operationId,
    ).toBe("listProjectTasks");
    expect(
      document.paths?.["/api/project-tasks/calendar"]?.get?.operationId,
    ).toBe("listProjectTaskCalendar");
    expect(
      document.paths?.["/api/project-tasks/undated"]?.get?.operationId,
    ).toBe("listUndatedProjectTasks");
    expect(
      document.paths?.["/api/projects/{projectId}/tasks"]?.post?.operationId,
    ).toBe("createProjectTask");
    expect(
      document.paths?.["/api/projects/{projectId}/tasks/{taskId}"]?.get
        ?.operationId,
    ).toBe("getProjectTask");
    expect(
      document.paths?.["/api/projects/{projectId}/tasks/{taskId}"]?.patch
        ?.operationId,
    ).toBe("updateProjectTask");
    expect(
      document.paths?.["/api/projects/{projectId}/tasks/{taskId}/responsibles"]
        ?.put?.operationId,
    ).toBe("replaceProjectTaskResponsibles");
    expect(
      document.paths?.["/api/projects/{projectId}/tasks/{taskId}/archive"]?.post
        ?.operationId,
    ).toBe("archiveProjectTask");
    expect(
      document.paths?.["/api/projects/{projectId}/tasks/{taskId}/restore"]?.post
        ?.operationId,
    ).toBe("restoreProjectTask");
    expect(
      document.paths?.["/api/projects/{projectId}/tasks/{taskId}"]?.delete,
    ).toBeUndefined();
    expect(document.paths?.["/api/team/invitations"]?.get?.operationId).toBe(
      "listPendingTeamInvitations",
    );
    expect(document.paths?.["/api/team/invitations"]?.get?.security).toEqual([
      { sessionCookie: [] },
    ]);
    expect(
      document.paths?.["/api/projects/{projectId}/assignments"]?.get
        ?.operationId,
    ).toBe("listProjectAssignments");
    expect(
      document.paths?.[
        "/api/projects/{projectId}/assignments"
      ]?.get?.parameters?.map(({ name }) => name),
    ).toEqual(expect.arrayContaining(["historyPage", "historyPageSize"]));
    expect(
      document.paths?.["/api/projects/{projectId}/assignments"]?.post
        ?.operationId,
    ).toBe("addProjectAssignments");
    expect(
      document.paths?.["/api/projects/{projectId}/assignment-candidates"]?.get
        ?.operationId,
    ).toBe("listProjectAssignmentCandidates");
    expect(
      document.paths?.["/api/projects/{projectId}/activities"]?.get
        ?.operationId,
    ).toBe("listProjectActivities");
    expect(document.components?.schemas?.ProjectActivityIdentity).toMatchObject(
      {
        type: "object",
        properties: {
          userId: expect.any(Object),
          alias: expect.any(Object),
          avatarColor: expect.any(Object),
          nameSnapshot: expect.any(Object),
          activeStudioMember: expect.any(Object),
          linkable: expect.any(Object),
        },
        required: [
          "userId",
          "alias",
          "avatarColor",
          "nameSnapshot",
          "activeStudioMember",
          "linkable",
        ],
      },
    );
    expect(document.components?.schemas?.ProjectActivity).toMatchObject({
      properties: {
        actor: expect.any(Object),
        subject: expect.any(Object),
      },
      required: ["id", "type", "actor", "subject", "details", "createdAt"],
    });
    expect(
      Object.keys(
        (
          document.components?.schemas?.ProjectActivity as {
            properties?: Record<string, unknown>;
          }
        ).properties ?? {},
      ).sort(),
    ).toEqual(["actor", "createdAt", "details", "id", "subject", "type"]);
    expect(
      document.paths?.["/api/team/members/{memberId}"]?.delete,
    ).toBeDefined();
  });

  test("serves Swagger UI against the local document endpoint", async () => {
    const app = createApp({
      auth: anonymousAuth,
      accountRecovery: testAccountRecoveryService,
      featureFlags: testFeatureFlagService,
      apiDocsEnabled: true,
      search: testSearchService,
      identity: testIdentityService,
      clients: testClientService,
      projects: testProjectService,
      projectEvents: testProjectEventService,
      projectStages: testProjectStageService,
      teamInvitations: testTeamInvitationService,
      projectCollaboration: testProjectCollaborationService,
      projectTasks: testProjectTaskService,
      dashboard: testDashboardService,
      myWork: testMyWorkService,
    });
    const response = await app.request("/docs");

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/html");
    expect(await response.text()).toContain("/openapi.json");
  });
});
