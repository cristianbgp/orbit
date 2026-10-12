export type UserInvitation = {
  id: string;
  organizationName: string;
  status: string;
  expiresAt: Date | string;
  createdAt: Date | string;
};

export function getActiveUserInvitations(
  invitations: UserInvitation[],
  now: Date = new Date(),
) {
  const nowTime = now.getTime();

  return invitations.filter((invitation) => {
    const expiration = new Date(invitation.expiresAt).getTime();
    return (
      invitation.status === "pending" &&
      Number.isFinite(expiration) &&
      expiration > nowTime
    );
  });
}
