import { readServerConfig } from "../config";
import { createDatabase } from "../db/client";
import { createOrbitAuth } from "./create-auth";
import { createClientService } from "../clients/client-service";
import { createDrizzleClientStore } from "../clients/drizzle-client-store";
import { createProjectService } from "../projects/project-service";
import { createDrizzleProjectStore } from "../projects/drizzle-project-store";
import { createProjectEventService } from "../project-events/project-event-service";
import { createDrizzleProjectEventStore } from "../project-events/drizzle-project-event-store";
import { createProjectStageService } from "../project-stages/project-stage-service";
import { createDrizzleProjectStageStore } from "../project-stages/drizzle-project-stage-store";
import { createDrizzleTeamInvitationStore } from "../team-invitations/drizzle-team-invitation-store";
import { createTeamInvitationService } from "../team-invitations/team-invitation-service";
import { createProjectCollaborationService } from "../project-collaboration/project-collaboration-service";
import { createDrizzleProjectCollaborationStore } from "../project-collaboration/drizzle-project-collaboration-store";
import { createProjectTaskService } from "../project-tasks/project-task-service";
import { createDrizzleProjectTaskStore } from "../project-tasks/drizzle-project-task-store";
import { createDrizzleIdentityStore } from "../identity/drizzle-identity-store";
import { createIdentityService } from "../identity/identity-service";
import { createDashboardService } from "../dashboard/dashboard-service";
import { createDrizzleDashboardStore } from "../dashboard/drizzle-dashboard-store";
import { createDrizzleMyWorkStore } from "../my-work/drizzle-my-work-store";
import { createMyWorkService } from "../my-work/my-work-service";
import { createSearchService } from "../search/search-service";
import { createDrizzleSearchStore } from "../search/drizzle-search-store";
import { createFeatureFlagService } from "../feature-flags/feature-flag-service";
import { createDrizzleFeatureFlagStore } from "../feature-flags/drizzle-feature-flag-store";
import { retrieveBlueprintSections } from "../help-assistant/blueprint-retrieval";
import { createGroqHelpProvider } from "../help-assistant/groq-help-provider";
import { createHelpRateLimiter } from "../help-assistant/help-rate-limiter";
import { createHelpAssistantService } from "../help-assistant/help-assistant-service";
import { createDrizzleAccountRecoveryStore } from "../account-recovery/drizzle-account-recovery-store";
import { createAccountRecoveryService } from "../account-recovery/account-recovery-service";
import { createCaseService } from "../cases/case-service";
import { createDrizzleCaseStore } from "../cases/drizzle-case-store";
import { createCaseUpdateService } from "../case-updates/case-update-service";
import { createDrizzleCaseUpdateStore } from "../case-updates/drizzle-case-update-store";
import { createCaseActionService } from "../case-actions/case-action-service";
import { createDrizzleCaseActionStore } from "../case-actions/drizzle-case-action-store";
import { createCaseEventService } from "../case-events/case-event-service";
import { createDrizzleCaseEventStore } from "../case-events/drizzle-case-event-store";
import { createCasePresentationService } from "../case-presentation/case-presentation-service";
import { createDrizzleCasePresentationStore } from "../case-presentation/drizzle-case-presentation-store";

export const config = readServerConfig();
export const database = createDatabase(config.databaseUrl);
const accountRecoveryStore = createDrizzleAccountRecoveryStore(database.db);
export const { auth, authService, passwordResetLinks } = createOrbitAuth({
  db: database.db,
  baseURL: config.url,
  secret: config.authSecret,
  trustedOrigin: config.allowedOrigin,
  webOrigin: config.allowedOrigin,
  trustSignupEmail: config.trustSignupEmail,
  onPasswordReset: (resetUser) =>
    accountRecoveryStore.recordCompleted({
      userId: resetUser.id,
      name: resetUser.name,
      email: resetUser.email,
    }),
});
export const accountRecoveryService = createAccountRecoveryService({
  store: accountRecoveryStore,
  issuer: passwordResetLinks,
});
export const clientService = createClientService(
  createDrizzleClientStore(database.db),
);
export const caseService = createCaseService(
  createDrizzleCaseStore(database.db),
);
export const caseUpdateService = createCaseUpdateService(
  createDrizzleCaseUpdateStore(database.db),
);
export const caseActionService = createCaseActionService(
  createDrizzleCaseActionStore(database.db),
);
export const caseEventService = createCaseEventService(
  createDrizzleCaseEventStore(database.db),
);
export const casePresentationService = createCasePresentationService(
  createDrizzleCasePresentationStore(database.db),
);
export const dashboardService = createDashboardService(
  createDrizzleDashboardStore(database.db),
);
export const myWorkService = createMyWorkService(
  createDrizzleMyWorkStore(database.db),
);
export const searchService = createSearchService(
  createDrizzleSearchStore(database.db),
);
export const featureFlagService = createFeatureFlagService(
  createDrizzleFeatureFlagStore(database.db),
);
export const helpAssistantService = createHelpAssistantService({
  retrieve: retrieveBlueprintSections,
  provider: createGroqHelpProvider({
    apiKey: config.groqApiKey,
    model: config.orbitHelpModel,
  }),
  limiter: createHelpRateLimiter(),
});
export const projectService = createProjectService(
  createDrizzleProjectStore(database.db),
);
export const projectEventService = createProjectEventService(
  createDrizzleProjectEventStore(database.db),
);
export const projectStageService = createProjectStageService(
  createDrizzleProjectStageStore(database.db),
);
export const teamInvitationService = createTeamInvitationService(
  createDrizzleTeamInvitationStore(database.db),
);
export const projectCollaborationService = createProjectCollaborationService(
  createDrizzleProjectCollaborationStore(database.db),
);
export const projectTaskService = createProjectTaskService(
  createDrizzleProjectTaskStore(database.db),
);
export const identityService = createIdentityService(
  createDrizzleIdentityStore(database.db),
);
