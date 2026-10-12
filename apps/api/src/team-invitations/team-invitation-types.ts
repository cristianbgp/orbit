export type TeamActor = {
  userId: string;
  organizationId: string;
};

export type PendingTeamInvitation = {
  id: string;
  email: string;
  role: "member";
  position: StudioMemberPosition | null;
  status: "pending";
  createdAt: Date;
  expiresAt: Date;
};
import type { StudioMemberPosition } from "../identity/studio-member-position";
