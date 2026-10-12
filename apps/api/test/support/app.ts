import { createApp, type CreateAppOptions } from "../../src/app";
import { testIdentityService } from "./identity-service";
import { testProjectTaskService } from "./project-task-service";
import { testDashboardService } from "./dashboard-service";
import { testMyWorkService } from "./my-work-service";
import { testProjectEventService } from "./project-event-service";
import { testSearchService } from "./search-service";
import { testFeatureFlagService } from "./feature-flag-service";
import { testAccountRecoveryService } from "./account-recovery-service";
import { testCaseService } from "./case-service";
import { testCaseUpdateService } from "./case-update-service";
import { testCaseActionService } from "./case-action-service";
import { testCaseEventService } from "./case-event-service";
import { testCasePresentationService } from "./case-presentation-service";

type TestAppOptions = Omit<
  CreateAppOptions,
  | "dashboard"
  | "identity"
  | "projectTasks"
  | "myWork"
  | "projectEvents"
  | "search"
  | "featureFlags"
  | "accountRecovery"
  | "cases"
  | "caseUpdates"
  | "caseActions"
  | "caseEvents"
  | "casePresentation"
> &
  Partial<
    Pick<
      CreateAppOptions,
      | "dashboard"
      | "identity"
      | "projectTasks"
      | "myWork"
      | "projectEvents"
      | "search"
      | "featureFlags"
      | "accountRecovery"
      | "cases"
      | "caseUpdates"
      | "caseActions"
      | "caseEvents"
      | "casePresentation"
    >
  >;

export function createTestApp(options: TestAppOptions) {
  return createApp({
    dashboard: testDashboardService,
    identity: testIdentityService,
    myWork: testMyWorkService,
    projectTasks: testProjectTaskService,
    projectEvents: testProjectEventService,
    search: testSearchService,
    featureFlags: testFeatureFlagService,
    accountRecovery: testAccountRecoveryService,
    cases: testCaseService,
    caseUpdates: testCaseUpdateService,
    caseActions: testCaseActionService,
    caseEvents: testCaseEventService,
    casePresentation: testCasePresentationService,
    ...options,
  });
}
