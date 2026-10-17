export type ProjectResponsibility = "responsible" | "member";

export type ProjectAssignmentEndReason =
  "project_unassigned" | "organization_removed";

export type ProjectCollaborationActor = {
  userId: string;
  organizationId: string;
};

export type ActiveCollaborationMember = {
  memberId: string;
  userId: string;
  organizationId: string;
  role: string;
  name: string;
  email: string;
};

export type ProjectAssignmentRecord = {
  id: string;
  organizationId: string;
  projectId: string;
  userId: string | null;
  userName: string;
  userEmail: string;
  userAlias: string;
  userAvatarColor: string | null;
  activeStudioMember: boolean;
  responsibility: ProjectResponsibility;
  assignedByUserId: string | null;
  assignedByName: string;
  assignedAt: Date;
  endedAt: Date | null;
  endedByUserId: string | null;
  endedByName: string | null;
  endReason: ProjectAssignmentEndReason | null;
};

export type ProjectAssignmentCandidate = {
  memberId: string;
  userId: string;
  name: string;
  email: string;
  userAlias: string;
  userAvatarColor: string | null;
  activeStudioMember: boolean;
  assigned: boolean;
};

export type ProjectActivityIdentityRecord = {
  userId: string | null;
  alias: string | null;
  avatarColor: string | null;
  nameSnapshot: string;
  activeStudioMember: boolean;
  linkable: boolean;
};

export type ProjectActivityRecord = {
  id: string;
  organizationId: string;
  projectId: string;
  type: string;
  actor: ProjectActivityIdentityRecord;
  subject: ProjectActivityIdentityRecord | null;
  details: Record<string, string | null>;
  createdAt: Date;
};
