import { createApp } from "./app";
import { createInMemoryRateLimiter } from "./rate-limit/in-memory-rate-limiter";
import {
  authService,
  accountRecoveryService,
  clientService,
  caseService,
  caseUpdateService,
  caseActionService,
  caseEventService,
  casePresentationService,
  config,
  dashboardService,
  featureFlagService,
  helpAssistantService,
  identityService,
  myWorkService,
  projectStageService,
  projectCollaborationService,
  projectEventService,
  projectService,
  projectTaskService,
  searchService,
  teamInvitationService,
} from "./auth/runtime";

const app = createApp({
  allowedOrigin: config.allowedOrigin,
  apiDocsEnabled: config.apiDocsEnabled,
  auth: authService,
  accountRecovery: accountRecoveryService,
  clients: clientService,
  cases: caseService,
  caseUpdates: caseUpdateService,
  caseActions: caseActionService,
  caseEvents: caseEventService,
  casePresentation: casePresentationService,
  dashboard: dashboardService,
  featureFlags: featureFlagService,
  helpAssistant: helpAssistantService,
  identity: identityService,
  myWork: myWorkService,
  search: searchService,
  projects: projectService,
  projectEvents: projectEventService,
  projectStages: projectStageService,
  projectCollaboration: projectCollaborationService,
  projectTasks: projectTaskService,
  rateLimiter: createInMemoryRateLimiter(),
  teamInvitations: teamInvitationService,
});

Bun.serve({
  port: config.port,
  fetch: app.fetch,
});

console.info(
  `\n  \x1b[32mHono\x1b[0m\n  Orbit API listening on port ${config.port}\n\n  \x1b[32m→\x1b[0m  Local:     ${config.url}\n  \x1b[32m→\x1b[0m  Swagger:   ${config.url}/docs\n`,
);
