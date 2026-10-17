import type { CaseActionRecord } from "../case-actions/case-action-types";
import type { CaseEventRecord } from "../case-events/case-event-types";
import type { CaseUpdateRecord } from "../case-updates/case-update-types";
import type {
  CaseResult,
  CaseStage,
  CaseStatus,
  CaseType,
} from "../cases/case-types";

export type CasePresentationActor = {
  userId: string;
  organizationId: string;
};

export type CasePresentationQuery = {
  statuses?: CaseStatus[];
  clientIds?: string[];
  types?: CaseType[];
  memberUserIds?: string[];
  includeCompletedActions?: boolean;
  includePastEvents?: boolean;
};

export type CasePresentationFilters = {
  statuses: CaseStatus[];
  clientIds: string[];
  types: CaseType[];
  memberUserIds: string[];
  includeCompletedActions: boolean;
  includePastEvents: boolean;
};

export type CasePresentationMember = {
  assignmentId: string;
  userId: string | null;
  fullName: string;
  alias: string;
  avatarColor: string | null;
  position: "partner" | "senior" | "junior" | "assistant" | "intern" | null;
  activeStudioMember: boolean;
};

export type CasePresentationCase = {
  id: string;
  identification: string;
  status: CaseStatus;
  result: CaseResult | null;
  type: CaseType | null;
  stage: CaseStage | null;
  docketNumber: string | null;
  periodKind: "year" | "month" | "month_range" | null;
  periodStart: string | null;
  periodEnd: string | null;
  team: CasePresentationMember[];
  followers: CasePresentationMember[];
  updates: CaseUpdateRecord[];
  backgrounds: CaseUpdateRecord[];
  actions: CaseActionRecord[];
  events: CaseEventRecord[];
};

export type CasePresentationClient = {
  id: string;
  name: string;
  cases: CasePresentationCase[];
};

export type CasePresentationTruncationScope =
  "cases" | "updates" | "actions" | "events";

export type CasePresentationResult = {
  generatedAt: Date;
  organizationDate: string;
  clients: CasePresentationClient[];
  truncated: {
    value: boolean;
    scopes: CasePresentationTruncationScope[];
  };
};
