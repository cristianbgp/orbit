export type CaseActionActor = { userId: string; organizationId: string };
export type CaseActionStatus = "pending" | "completed";
export type CaseActionListStatus = CaseActionStatus | "active" | "archived";

export type CaseActionIdentity = {
  userId: string | null;
  fullName: string;
  alias: string | null;
  avatarColor: string | null;
  activeStudioMember: boolean;
  activeCaseMember: boolean;
  linkable: boolean;
};

export type CaseActionValues = {
  description: string;
  assigneeUserId: string | null;
};

export type CaseActionRecord = {
  id: string;
  organizationId: string;
  caseId: string;
  description: string;
  status: CaseActionStatus;
  assignee: CaseActionIdentity | null;
  creator: CaseActionIdentity;
  completedAt: Date | null;
  completedByUserId: string | null;
  createdAt: Date;
  updatedAt: Date;
  archivedAt: Date | null;
};

export type CreateCaseActionInput = {
  description: string;
  assigneeUserId?: string | null;
};

export type UpdateCaseActionInput = {
  description?: string;
  assigneeUserId?: string | null;
  expectedUpdatedAt: string;
};
