import type { CaseStage, CaseStatus, CaseType } from "../cases/case-types";

export type CaseEventType = "oral_argument" | "interview" | "other";

export type CaseEventActor = {
  userId: string;
  organizationId: string;
};

export type CaseEventValues = {
  title: string;
  type: CaseEventType;
  date: string;
  description: string | null;
};

export type CaseEventRecord = CaseEventValues & {
  id: string;
  organizationId: string;
  caseId: string;
  createdByUserId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type CreateCaseEventInput = {
  title: string;
  type: CaseEventType;
  date: string;
  description?: string | null;
};

export type UpdateCaseEventInput = Partial<CreateCaseEventInput> & {
  expectedUpdatedAt: string;
};

export type CaseEventCalendarFilters = {
  from: string;
  to: string;
  caseStatus: CaseStatus;
  search?: string;
  types: CaseType[];
  clientIds: string[];
  memberUserIds: string[];
};

export type CaseEventCalendarItem = CaseEventRecord & {
  case: {
    id: string;
    identification: string;
    status: CaseStatus;
    type: CaseType | null;
    stage: CaseStage | null;
    docketNumber: string | null;
    client: { id: string; name: string };
  };
};
