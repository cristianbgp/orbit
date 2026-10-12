export type CaseUpdateActor = {
  userId: string;
  organizationId: string;
};

export type CaseUpdateStatus = "active" | "archived";
export type CaseUpdateKind = "update" | "background";

export type CaseUpdateCreator = {
  userId: string | null;
  fullName: string;
  alias: string | null;
  avatarColor: string | null;
  activeStudioMember: boolean;
  linkable: boolean;
};

export type CaseUpdateValues = {
  date: string;
  description: string;
  kind: CaseUpdateKind;
};

export type CaseUpdateRecord = CaseUpdateValues & {
  id: string;
  organizationId: string;
  caseId: string;
  creator: CaseUpdateCreator;
  createdAt: Date;
  updatedAt: Date;
  archivedAt: Date | null;
};

export type CreateCaseUpdateInput = Omit<CaseUpdateValues, "kind">;

export type UpdateCaseUpdateInput = Partial<CaseUpdateValues> & {
  expectedUpdatedAt: string;
};
