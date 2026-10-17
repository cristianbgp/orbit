import { OpenAPIHono } from "@hono/zod-openapi";
import { swaggerUI } from "@hono/swagger-ui";
import { cors } from "hono/cors";
import { secureHeaders } from "hono/secure-headers";
import type { MiddlewareHandler } from "hono";

import type { AuthService } from "./auth/types";
import type {
  CaseService,
  CaseRecord,
  CaseAssignmentRecord,
  CaseActivityRecord,
} from "./cases/case-service";
import { CaseServiceError } from "./cases/case-service";
import {
  CaseUpdateServiceError,
  type CaseUpdateService,
} from "./case-updates/case-update-service";
import type { CaseUpdateRecord } from "./case-updates/case-update-types";
import {
  CaseActionServiceError,
  type CaseActionService,
} from "./case-actions/case-action-service";
import type { CaseActionRecord } from "./case-actions/case-action-types";
import {
  CaseEventServiceError,
  type CaseEventService,
} from "./case-events/case-event-service";
import type {
  CaseEventCalendarItem,
  CaseEventRecord,
} from "./case-events/case-event-types";
import {
  CasePresentationServiceError,
  type CasePresentationService,
} from "./case-presentation/case-presentation-service";
import {
  CASE_CURRENCY_OPTIONS,
  CASE_ENTITY_OPTIONS,
  CASE_RESULT_OPTIONS,
  CASE_STAGE_OPTIONS,
  CASE_STATUS_OPTIONS,
  CASE_SUBTYPE_OPTIONS,
  CASE_TAX_OPTIONS,
  CASE_TYPE_OPTIONS,
} from "./cases/case-catalog";
import {
  addCaseAssignmentsRoute,
  archiveCaseRoute,
  createCaseRoute,
  endCaseAssignmentRoute,
  getCaseOptionsRoute,
  getCaseRoute,
  listCaseActivitiesRoute,
  listCaseAssignmentCandidatesRoute,
  listCaseAssignmentsRoute,
  listCasesGroupedByClientRoute,
  listCasesRoute,
  restoreCaseRoute,
  updateCaseRoute,
} from "./contracts/cases";
import {
  archiveCaseUpdateRoute,
  createCaseUpdateRoute,
  listCaseUpdatesRoute,
  moveCaseUpdatesToBackgroundRoute,
  previewMoveCaseUpdatesToBackgroundRoute,
  restoreCaseUpdateRoute,
  updateCaseUpdateRoute,
} from "./contracts/case-updates";
import {
  archiveCaseActionRoute,
  completeCaseActionRoute,
  createCaseActionRoute,
  listCaseActionsRoute,
  reopenCaseActionRoute,
  restoreCaseActionRoute,
  updateCaseActionRoute,
} from "./contracts/case-actions";
import {
  createCaseEventRoute,
  deleteCaseEventRoute,
  listCaseEventCalendarRoute,
  listCaseEventsRoute,
  updateCaseEventRoute,
} from "./contracts/case-events";
import { getCasePresentationRoute } from "./contracts/case-presentation";
import {
  AccountRecoveryServiceError,
  type AccountRecoveryService,
} from "./account-recovery/account-recovery-service";
import { createMemberPasswordRecoveryLinkRoute } from "./contracts/account-recovery";
import type { DashboardService } from "./dashboard/dashboard-service";
import { DashboardServiceError } from "./dashboard/dashboard-service";
import { listDashboardActivityRoute } from "./contracts/dashboard";
import {
  listMyAssignedTasksRoute,
  listMySupervisionRoute,
  listMyCaseActionsRoute,
} from "./contracts/my-work";
import {
  MyWorkServiceError,
  type MyWorkService,
} from "./my-work/my-work-service";
import type { MyWorkTask } from "./my-work/my-work-types";
import type { SearchService } from "./search/search-types";
import { SearchServiceError } from "./search/search-service";
import { searchGloballyRoute } from "./contracts/search";
import { getFeatureFlagsRoute } from "./contracts/feature-flags";
import { askOrbitHelpRoute } from "./contracts/help-assistant";
import type { FeatureFlagService } from "./feature-flags/feature-flag-types";
import { FeatureFlagServiceError } from "./feature-flags/feature-flag-service";
import {
  HelpAssistantServiceError,
  type HelpAssistantService,
} from "./help-assistant/help-assistant-service";
import { listPendingTeamInvitationsRoute } from "./contracts/team-invitations";
import type { ClientActor, ClientRecord } from "./clients/client-types";
import type { IdentityService } from "./identity/identity-service";
import type {
  StudioMemberProfile,
  UserProfile,
} from "./identity/identity-types";
import { IdentityServiceError } from "./identity/identity-service";
import {
  ClientServiceError,
  type ClientService,
} from "./clients/client-service";
import type {
  ProjectListItemRecord,
  ProjectRecord,
} from "./projects/project-types";
import type { ProjectEventRecord } from "./project-events/project-event-types";
import {
  ProjectEventServiceError,
  type ProjectEventService,
} from "./project-events/project-event-service";
import type { ProjectStageRecord } from "./project-stages/project-stage-types";
import type { ProjectTaskRecord } from "./project-tasks/project-task-types";
import {
  ProjectTaskServiceError,
  type ProjectTaskService,
} from "./project-tasks/project-task-service";
import type {
  ProjectActivityRecord,
  ProjectAssignmentRecord,
} from "./project-collaboration/project-collaboration-types";
import {
  ProjectCollaborationServiceError,
  type ProjectCollaborationService,
} from "./project-collaboration/project-collaboration-service";
import {
  ProjectStageServiceError,
  type ProjectStageService,
} from "./project-stages/project-stage-service";
import {
  ProjectServiceError,
  type ProjectService,
} from "./projects/project-service";
import {
  TeamInvitationServiceError,
  type TeamInvitationService,
} from "./team-invitations/team-invitation-service";
import {
  createClientRoute,
  getClientRoute,
  listClientsRoute,
  updateClientRoute,
} from "./contracts/clients";
import {
  archiveProjectRoute,
  createProjectRoute,
  getProjectRoute,
  listProjectsRoute,
  listProjectsGroupedByClientRoute,
  restoreProjectRoute,
  updateProjectRoute,
} from "./contracts/projects";
import {
  createProjectStageRoute,
  deleteProjectStageRoute,
  listProjectStagesRoute,
  reorderProjectStagesRoute,
  updateProjectStageRoute,
} from "./contracts/project-stages";
import { healthRoute } from "./contracts/health";
import {
  currentUserRoute,
  getTeamMemberRoute,
  listTeamMembersRoute,
  updateCurrentUserRoute,
  updateTeamMemberPositionRoute,
} from "./contracts/identity";
import {
  addProjectAssignmentsRoute,
  listProjectActivitiesRoute,
  listProjectAssignmentCandidatesRoute,
  listProjectAssignmentsRoute,
  removeProjectAssignmentRoute,
  removeTeamMemberRoute,
  updateProjectAssignmentRoute,
} from "./contracts/project-collaboration";
import {
  archiveProjectTaskRoute,
  createProjectTaskRoute,
  getProjectTaskRoute,
  getProjectTaskScheduleRoute,
  listProjectTaskCalendarRoute,
  listProjectTasksRoute,
  listUndatedProjectTasksRoute,
  replaceProjectTaskResponsiblesRoute,
  restoreProjectTaskRoute,
  updateProjectTaskRoute,
} from "./contracts/project-tasks";
import {
  createProjectEventRoute,
  deleteProjectEventRoute,
  listProjectEventsRoute,
  updateProjectEventRoute,
} from "./contracts/project-events";
import { createInMemoryRateLimiter } from "./rate-limit/in-memory-rate-limiter";
import { consumeAuthenticatedRateLimit } from "./rate-limit/rate-limit-middleware";
import type { RateLimiter } from "./rate-limit/rate-limit-types";

export type CreateAppOptions = {
  allowedOrigin?: string;
  apiDocsEnabled?: boolean;
  auth: AuthService;
  accountRecovery: AccountRecoveryService;
  clients: ClientService;
  cases?: CaseService;
  caseUpdates?: CaseUpdateService;
  caseActions?: CaseActionService;
  caseEvents?: CaseEventService;
  casePresentation?: CasePresentationService;
  dashboard: DashboardService;
  myWork: MyWorkService;
  search: SearchService;
  featureFlags: FeatureFlagService;
  helpAssistant?: HelpAssistantService;
  identity: IdentityService;
  projects: ProjectService;
  projectEvents: ProjectEventService;
  projectStages: ProjectStageService;
  projectCollaboration: ProjectCollaborationService;
  projectTasks: ProjectTaskService;
  rateLimiter?: RateLimiter;
  teamInvitations: TeamInvitationService;
};

type OrbitEnv = { Variables: { organizationActor: ClientActor } };

const DEFAULT_ALLOWED_ORIGIN = "http://localhost:5173";

export function createApp(options: CreateAppOptions) {
  const cases =
    options.cases ??
    ({
      list: async () => ({
        cases: [],
        pagination: { page: 1, pageSize: 25, total: 0, totalPages: 0 },
      }),
      listGroupedByClient: async () => ({
        groups: [],
        caseTotal: 0,
        pagination: { page: 1, pageSize: 10, total: 0, totalPages: 0 },
      }),
    } as unknown as CaseService);
  const caseUpdates =
    options.caseUpdates ??
    ({
      list: async () => ({
        updates: [],
        pagination: { page: 1, pageSize: 10, total: 0, totalPages: 0 },
      }),
    } as unknown as CaseUpdateService);
  const caseActions =
    options.caseActions ??
    ({
      list: async () => ({
        actions: [],
        pagination: { page: 1, pageSize: 20, total: 0, totalPages: 0 },
      }),
    } as unknown as CaseActionService);
  const caseEvents =
    options.caseEvents ??
    ({
      list: async () => ({
        events: [],
        pagination: { page: 1, pageSize: 25, total: 0, totalPages: 0 },
      }),
    } as unknown as CaseEventService);
  const casePresentation =
    options.casePresentation ??
    ({
      list: async () => ({
        generatedAt: new Date(),
        organizationDate: new Date().toISOString().slice(0, 10),
        clients: [],
        truncated: { value: false, scopes: [] },
      }),
    } as unknown as CasePresentationService);
  const rateLimiter = options.rateLimiter ?? createInMemoryRateLimiter();
  const app = new OpenAPIHono<OrbitEnv>({
    defaultHook(result, context) {
      if (!result.success) {
        return context.json(
          {
            error: {
              code: "VALIDATION_ERROR" as const,
              message: "Revisa los datos enviados." as const,
            },
          },
          400,
        );
      }
    },
  });

  app.openAPIRegistry.registerComponent("securitySchemes", "sessionCookie", {
    type: "apiKey",
    in: "cookie",
    name: "better-auth.session_token",
    description:
      "Better Auth session cookie. Secure deployments may prefix the cookie name.",
  });

  app.use("*", secureHeaders());

  app.use(
    "*",
    cors({
      origin: options.allowedOrigin ?? DEFAULT_ALLOWED_ORIGIN,
      allowHeaders: ["Content-Type", "Authorization"],
      allowMethods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
      credentials: true,
      maxAge: 600,
    }),
  );

  app.on(["GET", "POST"], "/api/auth/*", (context) =>
    options.auth.handler(context.req.raw),
  );

  app.openapi(healthRoute, (context) =>
    context.json({
      status: "ok" as const,
      service: "orbit-api" as const,
    }),
  );

  app.openapi(currentUserRoute, async (context) => {
    const authSession = await options.auth.getSession(context.req.raw.headers);

    if (!authSession) {
      return context.json(
        {
          error: {
            code: "UNAUTHORIZED" as const,
            message: "Autenticación requerida." as const,
          },
        },
        401,
      );
    }

    const rateLimit = consumeAuthenticatedRateLimit(
      rateLimiter,
      authSession.user.id,
    );
    if (rateLimit) {
      return context.json(rateLimit.body, 429, rateLimit.headers);
    }

    const user = await options.identity.getCurrentUser(authSession.user.id);
    return context.json({ user: serializeUserProfile(user) }, 200);
  });

  app.openapi(updateCurrentUserRoute, async (context) => {
    const authSession = await options.auth.getSession(context.req.raw.headers);

    if (!authSession) {
      return context.json(
        {
          error: {
            code: "UNAUTHORIZED" as const,
            message: "Autenticación requerida." as const,
          },
        },
        401,
      );
    }

    const rateLimit = consumeAuthenticatedRateLimit(
      rateLimiter,
      authSession.user.id,
    );
    if (rateLimit) {
      return context.json(rateLimit.body, 429, rateLimit.headers);
    }

    const user = await options.identity.updateCurrentUser(
      authSession.user.id,
      context.req.valid("json"),
    );
    return context.json({ user: serializeUserProfile(user) }, 200);
  });

  const requireOrganizationActor: MiddlewareHandler<OrbitEnv> = async (
    context,
    next,
  ) => {
    const authSession = await options.auth.getSession(context.req.raw.headers);

    if (!authSession) {
      return context.json(
        {
          error: {
            code: "UNAUTHORIZED" as const,
            message: "Autenticación requerida." as const,
          },
        },
        401,
      );
    }

    if (!authSession.session.activeOrganizationId) {
      return context.json(
        {
          error: {
            code: "ORGANIZATION_REQUIRED" as const,
            message: "Selecciona un estudio para continuar." as const,
          },
        },
        409,
      );
    }

    context.set("organizationActor", {
      userId: authSession.user.id,
      organizationId: authSession.session.activeOrganizationId,
    });

    const rateLimit = consumeAuthenticatedRateLimit(
      rateLimiter,
      authSession.user.id,
    );
    if (rateLimit) {
      return context.json(rateLimit.body, 429, rateLimit.headers);
    }

    await next();
  };

  app.use("/api/clients", requireOrganizationActor);
  app.use("/api/clients/*", requireOrganizationActor);
  app.use("/api/cases", requireOrganizationActor);
  app.use("/api/cases/*", requireOrganizationActor);
  app.use("/api/case-events/*", requireOrganizationActor);
  app.use("/api/projects", requireOrganizationActor);
  app.use("/api/projects/*", requireOrganizationActor);
  app.use("/api/project-tasks", requireOrganizationActor);
  app.use("/api/project-tasks/*", requireOrganizationActor);
  app.use("/api/dashboard/*", requireOrganizationActor);
  app.use("/api/my-work/*", requireOrganizationActor);
  app.use("/api/search", requireOrganizationActor);
  app.use("/api/features", requireOrganizationActor);
  app.use("/api/help/*", requireOrganizationActor);
  app.use("/api/help/*", async (context, next) => {
    await options.featureFlags.assertEnabled(
      context.get("organizationActor").organizationId,
      "orbit_help_assistant",
    );
    await next();
  });
  app.use("/api/team/invitations", requireOrganizationActor);
  app.use("/api/team/members", requireOrganizationActor);
  app.use("/api/team/members/*", requireOrganizationActor);
  app.use("/api/team/users/*", requireOrganizationActor);

  app.onError((error, context) => {
    if (error instanceof CasePresentationServiceError) {
      return context.json(
        { error: { code: error.code, message: error.message } },
        403,
      );
    }
    if (error instanceof CaseEventServiceError) {
      const status =
        error.code === "FORBIDDEN"
          ? 403
          : error.code === "NOT_FOUND"
            ? 404
            : error.code === "VALIDATION_ERROR"
              ? 400
              : 409;
      return context.json(
        { error: { code: error.code, message: error.message } },
        status,
      );
    }
    if (error instanceof CaseActionServiceError) {
      const status =
        error.code === "FORBIDDEN"
          ? 403
          : error.code === "NOT_FOUND"
            ? 404
            : error.code === "VALIDATION_ERROR" ||
                error.code === "ASSIGNEE_NOT_FOUND"
              ? 400
              : 409;
      return context.json(
        { error: { code: error.code, message: error.message } },
        status,
      );
    }
    if (error instanceof CaseUpdateServiceError) {
      const status =
        error.code === "FORBIDDEN"
          ? 403
          : error.code === "NOT_FOUND"
            ? 404
            : error.code === "VALIDATION_ERROR"
              ? 400
              : 409;
      return context.json(
        { error: { code: error.code, message: error.message } },
        status,
      );
    }
    if (error instanceof CaseServiceError) {
      const status =
        error.code === "FORBIDDEN"
          ? 403
          : error.code === "NOT_FOUND" || error.code === "CLIENT_NOT_FOUND"
            ? 404
            : error.code === "VALIDATION_ERROR" ||
                error.code === "MEMBER_NOT_FOUND"
              ? 400
              : 409;
      return context.json(
        { error: { code: error.code, message: error.message } },
        status,
      );
    }
    if (error instanceof HelpAssistantServiceError) {
      return context.json(
        { error: { code: error.code, message: error.message } },
        error.code === "HELP_RATE_LIMITED" ? 429 : 503,
      );
    }
    if (error instanceof FeatureFlagServiceError) {
      return context.json(
        { error: { code: error.code, message: error.message } },
        403,
      );
    }
    if (error instanceof DashboardServiceError) {
      return context.json(
        { error: { code: error.code, message: error.message } },
        error.code === "INVALID_CURSOR" ? 400 : 403,
      );
    }
    if (error instanceof MyWorkServiceError) {
      return context.json(
        { error: { code: error.code, message: error.message } },
        403,
      );
    }
    if (error instanceof SearchServiceError) {
      return context.json(
        { error: { code: error.code, message: error.message } },
        403,
      );
    }
    if (
      error instanceof TeamInvitationServiceError &&
      error.code === "FORBIDDEN"
    ) {
      return context.json(
        {
          error: {
            code: "FORBIDDEN" as const,
            message: "No puedes ver las invitaciones de este estudio." as const,
          },
        },
        403,
      );
    }

    if (error instanceof ClientServiceError && error.code === "FORBIDDEN") {
      return context.json(
        {
          error: {
            code: "FORBIDDEN" as const,
            message: "No tienes acceso a este estudio." as const,
          },
        },
        403,
      );
    }

    if (error instanceof ClientServiceError && error.code === "NOT_FOUND") {
      return context.json(
        {
          error: {
            code: "NOT_FOUND" as const,
            message: "Cliente no encontrado." as const,
          },
        },
        404,
      );
    }

    if (error instanceof IdentityServiceError) {
      const status =
        error.code === "VALIDATION_ERROR"
          ? 400
          : error.code === "FORBIDDEN"
            ? 403
            : 404;
      return context.json(
        { error: { code: error.code, message: error.message } },
        status,
      );
    }

    if (error instanceof AccountRecoveryServiceError) {
      const status =
        error.code === "FORBIDDEN"
          ? 403
          : error.code === "NOT_FOUND"
            ? 404
            : 503;
      return context.json(
        { error: { code: error.code, message: error.message } },
        status,
      );
    }

    if (error instanceof ProjectServiceError && error.code === "FORBIDDEN") {
      return context.json(
        {
          error: {
            code: "FORBIDDEN" as const,
            message: "No tienes acceso a este estudio." as const,
          },
        },
        403,
      );
    }

    if (error instanceof ProjectEventServiceError) {
      const status =
        error.code === "FORBIDDEN"
          ? 403
          : error.code === "NOT_FOUND"
            ? 404
            : error.code === "VALIDATION_ERROR"
              ? 400
              : 409;
      return context.json(
        { error: { code: error.code, message: error.message } },
        status,
      );
    }

    if (error instanceof ProjectServiceError && error.code === "NOT_FOUND") {
      return context.json(
        {
          error: {
            code: "NOT_FOUND" as const,
            message: "Proyecto no encontrado." as const,
          },
        },
        404,
      );
    }

    if (
      error instanceof ProjectServiceError &&
      error.code === "CLIENT_NOT_FOUND"
    ) {
      return context.json(
        {
          error: {
            code: "NOT_FOUND" as const,
            message: "Cliente no disponible." as const,
          },
        },
        404,
      );
    }

    if (
      error instanceof ProjectServiceError &&
      error.code === "INVALID_DATES"
    ) {
      return context.json(
        {
          error: {
            code: "VALIDATION_ERROR" as const,
            message: error.message,
          },
        },
        400,
      );
    }

    if (
      error instanceof ProjectServiceError &&
      error.code === "MEMBER_NOT_FOUND"
    ) {
      return context.json(
        {
          error: {
            code: "VALIDATION_ERROR" as const,
            message: error.message,
          },
        },
        400,
      );
    }

    if (
      error instanceof ProjectServiceError &&
      error.code === "PROJECT_ARCHIVED"
    ) {
      return context.json(
        {
          error: { code: "PROJECT_ARCHIVED" as const, message: error.message },
        },
        409,
      );
    }

    if (
      error instanceof ProjectServiceError &&
      error.code === "PROJECT_ARCHIVE_CONFLICT"
    ) {
      return context.json(
        {
          error: {
            code: "PROJECT_ARCHIVE_CONFLICT" as const,
            message: error.message,
          },
        },
        409,
      );
    }

    if (
      error instanceof ProjectStageServiceError &&
      error.code === "FORBIDDEN"
    ) {
      return context.json(
        { error: { code: "FORBIDDEN" as const, message: error.message } },
        403,
      );
    }

    if (error instanceof ProjectCollaborationServiceError) {
      const status =
        error.code === "FORBIDDEN"
          ? 403
          : error.code === "NOT_FOUND"
            ? 404
            : error.code === "VALIDATION_ERROR"
              ? 400
              : 409;
      return context.json(
        { error: { code: error.code, message: error.message } },
        status,
      );
    }

    if (error instanceof ProjectTaskServiceError) {
      const status =
        error.code === "FORBIDDEN"
          ? 403
          : error.code === "NOT_FOUND"
            ? 404
            : error.code === "VALIDATION_ERROR"
              ? 400
              : 409;
      return context.json(
        { error: { code: error.code, message: error.message } },
        status,
      );
    }

    if (
      error instanceof ProjectStageServiceError &&
      error.code === "NOT_FOUND"
    ) {
      return context.json(
        { error: { code: "NOT_FOUND" as const, message: error.message } },
        404,
      );
    }

    if (
      error instanceof ProjectStageServiceError &&
      error.code === "INVALID_ORDER"
    ) {
      return context.json(
        { error: { code: "INVALID_ORDER" as const, message: error.message } },
        400,
      );
    }

    if (
      error instanceof ProjectStageServiceError &&
      error.code === "CONFLICT"
    ) {
      return context.json(
        { error: { code: "CONFLICT" as const, message: error.message } },
        409,
      );
    }

    if (
      error instanceof ProjectStageServiceError &&
      error.code === "PROJECT_ARCHIVED"
    ) {
      return context.json(
        {
          error: { code: "PROJECT_ARCHIVED" as const, message: error.message },
        },
        409,
      );
    }

    throw error;
  });

  function serializeClient(record: ClientRecord) {
    return {
      id: record.id,
      type: record.type,
      name: record.name,
      documentType: record.documentType,
      documentNumber: record.documentNumber,
      email: record.email,
      phone: record.phone,
      address: record.address,
      notes: record.notes,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
    };
  }

  function serializeUserProfile(record: UserProfile) {
    return {
      ...record,
      createdAt: record.createdAt.toISOString(),
    };
  }

  function serializeStudioMember(record: StudioMemberProfile) {
    return {
      ...record,
      memberSince: record.memberSince.toISOString(),
    };
  }

  function serializeProject(record: ProjectRecord) {
    return {
      id: record.id,
      client: record.client,
      name: record.name,
      type: record.type,
      status: record.status,
      startDate: record.startDate,
      endDate: record.endDate,
      internalReference: record.internalReference,
      description: record.description,
      archivedAt: record.archivedAt?.toISOString() ?? null,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
    };
  }

  function serializeCase(record: CaseRecord) {
    return {
      ...record,
      organizationId: undefined,
      archivedAt: record.archivedAt?.toISOString() ?? null,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
    };
  }

  function serializeCaseAssignment(record: CaseAssignmentRecord) {
    return {
      ...record,
      assignedAt: record.assignedAt.toISOString(),
      endedAt: record.endedAt?.toISOString() ?? null,
    };
  }

  function serializeCaseActivity(record: CaseActivityRecord) {
    return { ...record, createdAt: record.createdAt.toISOString() };
  }

  function serializeCaseUpdate(record: CaseUpdateRecord) {
    return {
      ...record,
      organizationId: undefined,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
      archivedAt: record.archivedAt?.toISOString() ?? null,
    };
  }

  function serializeCaseAction(record: CaseActionRecord) {
    return {
      ...record,
      organizationId: undefined,
      completedAt: record.completedAt?.toISOString() ?? null,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
      archivedAt: record.archivedAt?.toISOString() ?? null,
    };
  }

  function serializeCaseEvent(record: CaseEventRecord) {
    return {
      id: record.id,
      title: record.title,
      type: record.type,
      date: record.date,
      description: record.description,
      createdByUserId: record.createdByUserId,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
    };
  }

  function serializeCaseEventCalendarItem(record: CaseEventCalendarItem) {
    return { ...serializeCaseEvent(record), case: record.case };
  }

  function serializeProjectListItem(record: ProjectListItemRecord) {
    return {
      ...serializeProject(record),
      team: record.team,
    };
  }

  function serializeProjectEvent(record: ProjectEventRecord) {
    return {
      id: record.id,
      title: record.title,
      type: record.type,
      date: record.date,
      description: record.description,
      createdByUserId: record.createdByUserId,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
    };
  }

  function serializeProjectStage(record: ProjectStageRecord) {
    return {
      id: record.id,
      name: record.name,
      description: record.description,
      position: record.position,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
    };
  }

  function serializeProjectAssignment(record: ProjectAssignmentRecord) {
    return {
      id: record.id,
      userId: record.userId,
      userName: record.userName,
      userEmail: record.userEmail,
      userAlias: record.userAlias,
      userAvatarColor: record.userAvatarColor,
      activeStudioMember: record.activeStudioMember,
      responsibility: record.responsibility,
      assignedByUserId: record.assignedByUserId,
      assignedByName: record.assignedByName,
      assignedAt: record.assignedAt.toISOString(),
      endedAt: record.endedAt?.toISOString() ?? null,
      endedByUserId: record.endedByUserId,
      endedByName: record.endedByName,
      endReason: record.endReason,
    };
  }

  function serializeProjectActivity(
    record: Pick<
      ProjectActivityRecord,
      "id" | "type" | "actor" | "subject" | "details" | "createdAt"
    >,
  ) {
    return {
      id: record.id,
      type: record.type,
      actor: record.actor,
      subject: record.subject,
      details: record.details,
      createdAt: record.createdAt.toISOString(),
    };
  }

  function serializeProjectTask(record: ProjectTaskRecord) {
    return {
      id: record.id,
      stage: {
        id: record.stageId,
        name: record.stageName,
        position: record.stagePosition,
      },
      title: record.title,
      description: record.description,
      status: record.status,
      plannedStartDate: record.plannedStartDate,
      internalDueDate: record.internalDueDate,
      position: record.position,
      archivedAt: record.archivedAt?.toISOString() ?? null,
      responsibles: record.responsibles.map((responsible) => ({
        ...responsible,
        assignedAt: responsible.assignedAt.toISOString(),
      })),
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
    };
  }

  function serializeMyWorkTask(record: MyWorkTask) {
    return {
      ...record,
      updatedAt: record.updatedAt.toISOString(),
      responsibles: record.responsibles.map((responsible) => ({
        ...responsible,
        assignedAt: responsible.assignedAt.toISOString(),
      })),
    };
  }

  app.openapi(listDashboardActivityRoute, async (context) => {
    const result = await options.dashboard.activity(
      context.get("organizationActor"),
      context.req.valid("query"),
    );
    return context.json(
      {
        ...result,
        activities: result.activities.map((activity) => ({
          ...serializeProjectActivity(activity),
          source: activity.source,
          project: activity.project
            ? {
                ...activity.project,
                archivedAt: activity.project.archivedAt?.toISOString() ?? null,
              }
            : null,
          case: activity.case
            ? {
                ...activity.case,
                archivedAt: activity.case.archivedAt?.toISOString() ?? null,
              }
            : null,
        })),
      },
      200,
    );
  });

  app.openapi(listMyAssignedTasksRoute, async (context) => {
    const result = await options.myWork.assignedTasks(
      context.get("organizationActor"),
      context.req.valid("query"),
    );
    return context.json(
      { ...result, tasks: result.tasks.map(serializeMyWorkTask) },
      200,
    );
  });

  app.openapi(listMySupervisionRoute, async (context) => {
    const result = await options.myWork.supervision(
      context.get("organizationActor"),
      context.req.valid("query"),
    );
    return context.json(
      {
        ...result,
        projects: result.projects.map((project) => ({
          ...project,
          attentionTasks: project.attentionTasks.map(serializeMyWorkTask),
        })),
      },
      200,
    );
  });

  app.openapi(listMyCaseActionsRoute, async (context) => {
    const result = await options.myWork.caseActions(
      context.get("organizationActor"),
      context.req.valid("query"),
    );
    return context.json(
      {
        ...result,
        actions: result.actions.map((action) => ({
          ...action,
          updatedAt: action.updatedAt.toISOString(),
          completedAt: action.completedAt?.toISOString() ?? null,
        })),
      },
      200,
    );
  });

  app.openapi(searchGloballyRoute, async (context) => {
    const result = await options.search.search(
      context.get("organizationActor"),
      context.req.valid("query"),
    );
    return context.json(result, 200);
  });

  app.openapi(getFeatureFlagsRoute, async (context) => {
    const features = await options.featureFlags.resolveForActor(
      context.get("organizationActor"),
    );
    return context.json({ features }, 200);
  });

  app.openapi(askOrbitHelpRoute, async (context) => {
    const actor = context.get("organizationActor");
    if (!options.helpAssistant) {
      throw new HelpAssistantServiceError(
        "HELP_PROVIDER_UNAVAILABLE",
        "Preguntar a Orbit no está disponible temporalmente.",
      );
    }
    const result = await options.helpAssistant.ask(
      actor,
      context.req.valid("json").question,
    );
    return context.json(result, 200);
  });

  app.openapi(getCaseOptionsRoute, (context) =>
    context.json(
      {
        types: [...CASE_TYPE_OPTIONS],
        subtypes: [...CASE_SUBTYPE_OPTIONS],
        stages: [...CASE_STAGE_OPTIONS],
        entities: [...CASE_ENTITY_OPTIONS],
        taxes: [...CASE_TAX_OPTIONS],
        currencies: [...CASE_CURRENCY_OPTIONS],
        statuses: [...CASE_STATUS_OPTIONS],
        results: [...CASE_RESULT_OPTIONS],
      },
      200,
    ),
  );

  app.openapi(listCasesRoute, async (context) => {
    const result = await cases.list(
      context.get("organizationActor"),
      context.req.valid("query"),
    );
    return context.json(
      { cases: result.cases.map(serializeCase), pagination: result.pagination },
      200,
    );
  });

  app.openapi(listCasesGroupedByClientRoute, async (context) => {
    const result = await cases.listGroupedByClient(
      context.get("organizationActor"),
      context.req.valid("query"),
    );
    return context.json(
      {
        groups: result.groups.map((group) => ({
          client: group.client,
          cases: group.cases.map(serializeCase),
        })),
        caseTotal: result.caseTotal,
        pagination: result.pagination,
      },
      200,
    );
  });

  app.openapi(getCasePresentationRoute, async (context) => {
    const result = await casePresentation.list(
      context.get("organizationActor"),
      context.req.valid("query"),
    );
    return context.json(
      {
        generatedAt: result.generatedAt.toISOString(),
        organizationDate: result.organizationDate,
        clients: result.clients.map((clientGroup) => ({
          ...clientGroup,
          cases: clientGroup.cases.map((caseRecord) => ({
            ...caseRecord,
            updates: caseRecord.updates.map(serializeCaseUpdate),
            actions: caseRecord.actions.map(serializeCaseAction),
            events: caseRecord.events.map(serializeCaseEvent),
          })),
        })),
        truncated: result.truncated,
      },
      200,
    );
  });

  app.openapi(createCaseRoute, async (context) => {
    const record = await cases.create(
      context.get("organizationActor"),
      context.req.valid("json"),
    );
    return context.json({ case: serializeCase(record) }, 201);
  });

  app.openapi(getCaseRoute, async (context) => {
    const record = await cases.get(
      context.get("organizationActor"),
      context.req.valid("param").caseId,
    );
    return context.json({ case: serializeCase(record) }, 200);
  });

  app.openapi(updateCaseRoute, async (context) => {
    const record = await cases.update(
      context.get("organizationActor"),
      context.req.valid("param").caseId,
      context.req.valid("json"),
    );
    return context.json({ case: serializeCase(record) }, 200);
  });

  app.openapi(archiveCaseRoute, async (context) => {
    const record = await cases.archive(
      context.get("organizationActor"),
      context.req.valid("param").caseId,
    );
    return context.json({ case: serializeCase(record) }, 200);
  });

  app.openapi(restoreCaseRoute, async (context) => {
    const record = await cases.restore(
      context.get("organizationActor"),
      context.req.valid("param").caseId,
    );
    return context.json({ case: serializeCase(record) }, 200);
  });

  app.openapi(listCaseAssignmentsRoute, async (context) => {
    const result = await cases.listAssignments(
      context.get("organizationActor"),
      context.req.valid("param").caseId,
      context.req.valid("query"),
    );
    return context.json(
      {
        active: result.active.map(serializeCaseAssignment),
        history: result.history.map(serializeCaseAssignment),
        historyTotal: result.historyTotal,
      },
      200,
    );
  });

  app.openapi(listCaseAssignmentCandidatesRoute, async (context) => {
    const members = await cases.listCandidates(
      context.get("organizationActor"),
      context.req.valid("param").caseId,
      context.req.valid("query").responsibility,
    );
    return context.json({ members }, 200);
  });

  app.openapi(addCaseAssignmentsRoute, async (context) => {
    await cases.addAssignments(
      context.get("organizationActor"),
      context.req.valid("param").caseId,
      context.req.valid("json").userIds,
      context.req.valid("json").responsibility,
    );
    return context.body(null, 204);
  });

  app.openapi(endCaseAssignmentRoute, async (context) => {
    const params = context.req.valid("param");
    await cases.endAssignment(
      context.get("organizationActor"),
      params.caseId,
      params.assignmentId,
    );
    return context.body(null, 204);
  });

  app.openapi(listCaseActivitiesRoute, async (context) => {
    const result = await cases.listActivities(
      context.get("organizationActor"),
      context.req.valid("param").caseId,
      context.req.valid("query"),
    );
    return context.json(
      {
        activities: result.activities.map(serializeCaseActivity),
        pagination: result.pagination,
      },
      200,
    );
  });

  app.openapi(listCaseUpdatesRoute, async (context) => {
    const result = await caseUpdates.list(
      context.get("organizationActor"),
      context.req.valid("param").caseId,
      context.req.valid("query"),
    );
    return context.json(
      {
        updates: result.updates.map(serializeCaseUpdate),
        pagination: result.pagination,
      },
      200,
    );
  });

  app.openapi(createCaseUpdateRoute, async (context) => {
    const record = await caseUpdates.create(
      context.get("organizationActor"),
      context.req.valid("param").caseId,
      context.req.valid("json"),
    );
    return context.json({ update: serializeCaseUpdate(record) }, 201);
  });

  app.openapi(updateCaseUpdateRoute, async (context) => {
    const params = context.req.valid("param");
    const record = await caseUpdates.update(
      context.get("organizationActor"),
      params.caseId,
      params.updateId,
      context.req.valid("json"),
    );
    return context.json({ update: serializeCaseUpdate(record) }, 200);
  });

  app.openapi(archiveCaseUpdateRoute, async (context) => {
    const params = context.req.valid("param");
    const record = await caseUpdates.archive(
      context.get("organizationActor"),
      params.caseId,
      params.updateId,
      context.req.valid("json").expectedUpdatedAt,
    );
    return context.json({ update: serializeCaseUpdate(record) }, 200);
  });

  app.openapi(restoreCaseUpdateRoute, async (context) => {
    const params = context.req.valid("param");
    const record = await caseUpdates.restore(
      context.get("organizationActor"),
      params.caseId,
      params.updateId,
      context.req.valid("json").expectedUpdatedAt,
    );
    return context.json({ update: serializeCaseUpdate(record) }, 200);
  });

  app.openapi(moveCaseUpdatesToBackgroundRoute, async (context) => {
    const result = await caseUpdates.moveAllToBackground(
      context.get("organizationActor"),
    );
    return context.json(result, 200);
  });

  app.openapi(previewMoveCaseUpdatesToBackgroundRoute, async (context) => {
    const result = await caseUpdates.previewMoveAllToBackground(
      context.get("organizationActor"),
    );
    return context.json(result, 200);
  });

  app.openapi(listCaseActionsRoute, async (context) => {
    const result = await caseActions.list(
      context.get("organizationActor"),
      context.req.valid("param").caseId,
      context.req.valid("query"),
    );
    return context.json(
      {
        actions: result.actions.map(serializeCaseAction),
        pagination: result.pagination,
      },
      200,
    );
  });

  app.openapi(createCaseActionRoute, async (context) => {
    const action = await caseActions.create(
      context.get("organizationActor"),
      context.req.valid("param").caseId,
      context.req.valid("json"),
    );
    return context.json({ action: serializeCaseAction(action) }, 201);
  });

  app.openapi(updateCaseActionRoute, async (context) => {
    const params = context.req.valid("param");
    const action = await caseActions.update(
      context.get("organizationActor"),
      params.caseId,
      params.actionId,
      context.req.valid("json"),
    );
    return context.json({ action: serializeCaseAction(action) }, 200);
  });

  for (const [route, method] of [
    [completeCaseActionRoute, "complete"],
    [reopenCaseActionRoute, "reopen"],
    [archiveCaseActionRoute, "archive"],
    [restoreCaseActionRoute, "restore"],
  ] as const) {
    app.openapi(route, async (context) => {
      const params = context.req.valid("param");
      const action = await caseActions[method](
        context.get("organizationActor"),
        params.caseId,
        params.actionId,
        context.req.valid("json").expectedUpdatedAt,
      );
      return context.json({ action: serializeCaseAction(action) }, 200);
    });
  }

  app.openapi(listCaseEventCalendarRoute, async (context) => {
    const result = await caseEvents.calendar(
      context.get("organizationActor"),
      context.req.valid("query"),
    );
    return context.json(
      {
        events: result.events.map(serializeCaseEventCalendarItem),
        truncated: result.truncated,
      },
      200,
    );
  });

  app.openapi(listCaseEventsRoute, async (context) => {
    const result = await caseEvents.list(
      context.get("organizationActor"),
      context.req.valid("param").caseId,
      context.req.valid("query"),
    );
    return context.json(
      {
        events: result.events.map(serializeCaseEvent),
        pagination: result.pagination,
      },
      200,
    );
  });

  app.openapi(createCaseEventRoute, async (context) => {
    const event = await caseEvents.create(
      context.get("organizationActor"),
      context.req.valid("param").caseId,
      context.req.valid("json"),
    );
    return context.json({ event: serializeCaseEvent(event) }, 201);
  });

  app.openapi(updateCaseEventRoute, async (context) => {
    const params = context.req.valid("param");
    const event = await caseEvents.update(
      context.get("organizationActor"),
      params.caseId,
      params.eventId,
      context.req.valid("json"),
    );
    return context.json({ event: serializeCaseEvent(event) }, 200);
  });

  app.openapi(deleteCaseEventRoute, async (context) => {
    const params = context.req.valid("param");
    await caseEvents.remove(
      context.get("organizationActor"),
      params.caseId,
      params.eventId,
      context.req.valid("json").expectedUpdatedAt,
    );
    return context.body(null, 204);
  });

  app.openapi(listClientsRoute, async (context) => {
    const result = await options.clients.list(
      context.get("organizationActor"),
      context.req.valid("query"),
    );
    return context.json(
      {
        clients: result.clients.map(serializeClient),
        pagination: result.pagination,
      },
      200,
    );
  });

  app.openapi(listTeamMembersRoute, async (context) => {
    const result = await options.identity.listMembers(
      context.get("organizationActor"),
      context.req.valid("query"),
    );
    return context.json(
      {
        members: result.members.map(serializeStudioMember),
        pagination: result.pagination,
      },
      200,
    );
  });

  app.openapi(getTeamMemberRoute, async (context) => {
    const member = await options.identity.getMember(
      context.get("organizationActor"),
      context.req.valid("param").userId,
    );
    return context.json({ member: serializeStudioMember(member) }, 200);
  });

  app.openapi(createMemberPasswordRecoveryLinkRoute, async (context) => {
    const link = await options.accountRecovery.generateForMember(
      context.get("organizationActor"),
      context.req.valid("param").userId,
    );
    context.header("Cache-Control", "no-store, private");
    return context.json(
      { url: link.url, expiresAt: link.expiresAt.toISOString() },
      200,
    );
  });

  app.openapi(updateTeamMemberPositionRoute, async (context) => {
    const member = await options.identity.updateMemberPosition(
      context.get("organizationActor"),
      context.req.valid("param").memberId,
      context.req.valid("json").position,
    );
    return context.json({ member: serializeStudioMember(member) }, 200);
  });

  app.openapi(createClientRoute, async (context) => {
    const record = await options.clients.create(
      context.get("organizationActor"),
      context.req.valid("json"),
    );
    return context.json({ client: serializeClient(record) }, 201);
  });

  app.openapi(getClientRoute, async (context) => {
    const record = await options.clients.get(
      context.get("organizationActor"),
      context.req.valid("param").clientId,
    );
    return context.json({ client: serializeClient(record) }, 200);
  });

  app.openapi(updateClientRoute, async (context) => {
    const record = await options.clients.update(
      context.get("organizationActor"),
      context.req.valid("param").clientId,
      context.req.valid("json"),
    );
    return context.json({ client: serializeClient(record) }, 200);
  });

  app.openapi(listProjectsRoute, async (context) => {
    const result = await options.projects.list(
      context.get("organizationActor"),
      context.req.valid("query"),
    );
    return context.json(
      {
        projects: result.projects.map(serializeProjectListItem),
        pagination: result.pagination,
      },
      200,
    );
  });

  app.openapi(listProjectsGroupedByClientRoute, async (context) => {
    const result = await options.projects.listGroupedByClient(
      context.get("organizationActor"),
      context.req.valid("query"),
    );
    return context.json(
      {
        groups: result.groups.map((group) => ({
          client: group.client,
          projects: group.projects.map(serializeProjectListItem),
        })),
        pagination: result.pagination,
        projectTotal: result.projectTotal,
      },
      200,
    );
  });

  app.openapi(createProjectRoute, async (context) => {
    const record = await options.projects.create(
      context.get("organizationActor"),
      context.req.valid("json"),
    );
    return context.json({ project: serializeProject(record) }, 201);
  });

  app.openapi(getProjectRoute, async (context) => {
    const record = await options.projects.get(
      context.get("organizationActor"),
      context.req.valid("param").projectId,
    );
    return context.json({ project: serializeProject(record) }, 200);
  });

  app.openapi(updateProjectRoute, async (context) => {
    const record = await options.projects.update(
      context.get("organizationActor"),
      context.req.valid("param").projectId,
      context.req.valid("json"),
    );
    return context.json({ project: serializeProject(record) }, 200);
  });

  app.openapi(archiveProjectRoute, async (context) => {
    const record = await options.projects.archive(
      context.get("organizationActor"),
      context.req.valid("param").projectId,
    );
    return context.json({ project: serializeProject(record) }, 200);
  });

  app.openapi(restoreProjectRoute, async (context) => {
    const record = await options.projects.restore(
      context.get("organizationActor"),
      context.req.valid("param").projectId,
    );
    return context.json({ project: serializeProject(record) }, 200);
  });

  app.openapi(listProjectEventsRoute, async (context) => {
    const result = await options.projectEvents.list(
      context.get("organizationActor"),
      context.req.valid("param").projectId,
      context.req.valid("query"),
    );
    return context.json(
      {
        events: result.events.map(serializeProjectEvent),
        pagination: result.pagination,
      },
      200,
    );
  });

  app.openapi(createProjectEventRoute, async (context) => {
    const event = await options.projectEvents.create(
      context.get("organizationActor"),
      context.req.valid("param").projectId,
      context.req.valid("json"),
    );
    return context.json({ event: serializeProjectEvent(event) }, 201);
  });

  app.openapi(updateProjectEventRoute, async (context) => {
    const params = context.req.valid("param");
    const event = await options.projectEvents.update(
      context.get("organizationActor"),
      params.projectId,
      params.eventId,
      context.req.valid("json"),
    );
    return context.json({ event: serializeProjectEvent(event) }, 200);
  });

  app.openapi(deleteProjectEventRoute, async (context) => {
    const params = context.req.valid("param");
    await options.projectEvents.remove(
      context.get("organizationActor"),
      params.projectId,
      params.eventId,
    );
    return context.body(null, 204);
  });

  app.openapi(listProjectStagesRoute, async (context) => {
    const records = await options.projectStages.list(
      context.get("organizationActor"),
      context.req.valid("param").projectId,
    );
    return context.json({ stages: records.map(serializeProjectStage) }, 200);
  });

  app.openapi(createProjectStageRoute, async (context) => {
    const record = await options.projectStages.create(
      context.get("organizationActor"),
      context.req.valid("param").projectId,
      context.req.valid("json"),
    );
    return context.json({ stage: serializeProjectStage(record) }, 201);
  });

  app.openapi(updateProjectStageRoute, async (context) => {
    const params = context.req.valid("param");
    const record = await options.projectStages.update(
      context.get("organizationActor"),
      params.projectId,
      params.stageId,
      context.req.valid("json"),
    );
    return context.json({ stage: serializeProjectStage(record) }, 200);
  });

  app.openapi(reorderProjectStagesRoute, async (context) => {
    const records = await options.projectStages.reorder(
      context.get("organizationActor"),
      context.req.valid("param").projectId,
      context.req.valid("json"),
    );
    return context.json({ stages: records.map(serializeProjectStage) }, 200);
  });

  app.openapi(deleteProjectStageRoute, async (context) => {
    const params = context.req.valid("param");
    await options.projectStages.remove(
      context.get("organizationActor"),
      params.projectId,
      params.stageId,
    );
    return context.body(null, 204);
  });

  app.openapi(listProjectTasksRoute, async (context) => {
    const result = await options.projectTasks.list(
      context.get("organizationActor"),
      context.req.valid("param").projectId,
      context.req.valid("query"),
    );
    return context.json(
      {
        tasks: result.tasks.map(serializeProjectTask),
        pagination: result.pagination,
      },
      200,
    );
  });

  app.openapi(listProjectTaskCalendarRoute, async (context) => {
    const result = await options.projectTasks.calendar(
      context.get("organizationActor"),
      context.req.valid("query"),
    );
    return context.json(
      {
        ...result,
        tasks: result.tasks.map((task) => ({
          ...task,
          responsibles: task.responsibles.map((responsible) => ({
            ...responsible,
            assignedAt: responsible.assignedAt.toISOString(),
          })),
        })),
      },
      200,
    );
  });

  app.openapi(listUndatedProjectTasksRoute, async (context) => {
    const result = await options.projectTasks.listUndated(
      context.get("organizationActor"),
      context.req.valid("query"),
    );
    return context.json(
      {
        ...result,
        tasks: result.tasks.map((task) => ({
          ...task,
          responsibles: task.responsibles.map((responsible) => ({
            ...responsible,
            assignedAt: responsible.assignedAt.toISOString(),
          })),
        })),
      },
      200,
    );
  });

  app.openapi(getProjectTaskScheduleRoute, async (context) => {
    const schedule = await options.projectTasks.schedule(
      context.get("organizationActor"),
      context.req.valid("param").projectId,
    );
    return context.json(schedule, 200);
  });

  app.openapi(createProjectTaskRoute, async (context) => {
    const record = await options.projectTasks.create(
      context.get("organizationActor"),
      context.req.valid("param").projectId,
      context.req.valid("json"),
    );
    return context.json({ task: serializeProjectTask(record) }, 201);
  });

  app.openapi(getProjectTaskRoute, async (context) => {
    const params = context.req.valid("param");
    const record = await options.projectTasks.get(
      context.get("organizationActor"),
      params.projectId,
      params.taskId,
    );
    return context.json({ task: serializeProjectTask(record) }, 200);
  });

  app.openapi(updateProjectTaskRoute, async (context) => {
    const params = context.req.valid("param");
    const record = await options.projectTasks.update(
      context.get("organizationActor"),
      params.projectId,
      params.taskId,
      context.req.valid("json"),
    );
    return context.json({ task: serializeProjectTask(record) }, 200);
  });

  app.openapi(replaceProjectTaskResponsiblesRoute, async (context) => {
    const params = context.req.valid("param");
    const record = await options.projectTasks.replaceResponsibles(
      context.get("organizationActor"),
      params.projectId,
      params.taskId,
      context.req.valid("json").responsibleUserIds,
    );
    return context.json({ task: serializeProjectTask(record) }, 200);
  });

  app.openapi(archiveProjectTaskRoute, async (context) => {
    const params = context.req.valid("param");
    const record = await options.projectTasks.archive(
      context.get("organizationActor"),
      params.projectId,
      params.taskId,
    );
    return context.json({ task: serializeProjectTask(record) }, 200);
  });

  app.openapi(restoreProjectTaskRoute, async (context) => {
    const params = context.req.valid("param");
    const record = await options.projectTasks.restore(
      context.get("organizationActor"),
      params.projectId,
      params.taskId,
    );
    return context.json({ task: serializeProjectTask(record) }, 200);
  });

  app.openapi(listProjectAssignmentsRoute, async (context) => {
    const result = await options.projectCollaboration.listAssignments(
      context.get("organizationActor"),
      context.req.valid("param").projectId,
      context.req.valid("query"),
    );
    return context.json(
      {
        active: result.active.map(serializeProjectAssignment),
        history: result.history.map(serializeProjectAssignment),
        historyPagination: result.historyPagination,
      },
      200,
    );
  });

  app.openapi(listProjectAssignmentCandidatesRoute, async (context) => {
    const result = await options.projectCollaboration.listCandidates(
      context.get("organizationActor"),
      context.req.valid("param").projectId,
      context.req.valid("query"),
    );
    return context.json(result, 200);
  });

  app.openapi(addProjectAssignmentsRoute, async (context) => {
    const records = await options.projectCollaboration.addAssignments(
      context.get("organizationActor"),
      context.req.valid("param").projectId,
      context.req.valid("json").assignments,
    );
    return context.json(
      { assignments: records.map(serializeProjectAssignment) },
      201,
    );
  });

  app.openapi(updateProjectAssignmentRoute, async (context) => {
    const params = context.req.valid("param");
    const record = await options.projectCollaboration.changeResponsibility(
      context.get("organizationActor"),
      params.projectId,
      params.assignmentId,
      context.req.valid("json").responsibility,
    );
    return context.json(
      { assignment: serializeProjectAssignment(record) },
      200,
    );
  });

  app.openapi(removeProjectAssignmentRoute, async (context) => {
    const params = context.req.valid("param");
    const record = await options.projectCollaboration.endAssignment(
      context.get("organizationActor"),
      params.projectId,
      params.assignmentId,
    );
    return context.json(
      { assignment: serializeProjectAssignment(record) },
      200,
    );
  });

  app.openapi(listProjectActivitiesRoute, async (context) => {
    const result = await options.projectCollaboration.listActivities(
      context.get("organizationActor"),
      context.req.valid("param").projectId,
      context.req.valid("query"),
    );
    return context.json(
      {
        activities: result.activities.map(serializeProjectActivity),
        pagination: result.pagination,
      },
      200,
    );
  });

  app.openapi(removeTeamMemberRoute, async (context) => {
    const removed = await options.projectCollaboration.removeOrganizationMember(
      context.get("organizationActor"),
      context.req.valid("param").memberId,
    );
    return context.json({ member: removed }, 200);
  });

  app.openapi(listPendingTeamInvitationsRoute, async (context) => {
    const records = await options.teamInvitations.listPending(
      context.get("organizationActor"),
    );
    return context.json(
      {
        invitations: records.map((record) => ({
          ...record,
          createdAt: record.createdAt.toISOString(),
          expiresAt: record.expiresAt.toISOString(),
        })),
      },
      200,
    );
  });

  if (options.apiDocsEnabled) {
    app.doc31("/openapi.json", {
      openapi: "3.1.0",
      info: {
        title: "Orbit API",
        version: "0.1.0",
      },
      tags: [
        { name: "System", description: "API system status." },
        {
          name: "Identity",
          description: "Authenticated application identity.",
        },
        {
          name: "Dashboard",
          description: "Studio-wide operational attention overview.",
        },
        {
          name: "My work",
          description: "Current user's assigned tasks and supervised projects.",
        },
        {
          name: "Search",
          description: "Organization-scoped global record search.",
        },
        {
          name: "Feature flags",
          description: "Effective capabilities for the active organization.",
        },
        {
          name: "Clients",
          description: "Organization-scoped client records.",
        },
        {
          name: "Projects",
          description: "Organization-scoped legal projects.",
        },
        {
          name: "Cases",
          description: "Organization-scoped legal and tax proceedings.",
        },
        {
          name: "Project stages",
          description: "Ordered, editable legal project stages.",
        },
        {
          name: "Project collaboration",
          description:
            "Informational project assignments and responsibilities.",
        },
        {
          name: "Project tasks",
          description: "Assignable, archivable tasks within a project.",
        },
        {
          name: "Activity",
          description: "Immutable, system-generated project activity.",
        },
        {
          name: "Team",
          description: "Organization team visibility and invitations.",
        },
      ],
    });
    app.get("/docs", swaggerUI({ url: "/openapi.json" }));
  }

  return app;
}
