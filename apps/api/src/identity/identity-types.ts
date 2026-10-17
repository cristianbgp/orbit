import type { AvatarColor } from "./avatar-color";
import type { StudioMemberPosition } from "./studio-member-position";

export type UserProfileRecord = {
  id: string;
  alias: string | null;
  avatarColor: string | null;
  name: string;
  email: string;
  image: string | null;
  createdAt: Date;
};

export type StudioMemberRecord = {
  memberId: string;
  userId: string;
  alias: string | null;
  avatarColor: string | null;
  name: string;
  email: string;
  image: string | null;
  role: string;
  position: StudioMemberPosition | null;
  memberSince: Date;
};

export type IdentityActor = {
  userId: string;
  organizationId: string;
};

export type UserProfile = Omit<UserProfileRecord, "alias" | "avatarColor"> & {
  alias: string;
  avatarColor: AvatarColor;
};

export type StudioMemberProfile = Omit<
  StudioMemberRecord,
  "alias" | "avatarColor"
> & {
  alias: string;
  avatarColor: AvatarColor;
  isCurrentUser: boolean;
};
