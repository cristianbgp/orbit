import { APIError } from "better-auth";

export type MembershipLookup = (userId: string) => Promise<boolean>;

export const ORGANIZATION_MEMBERSHIP_EXISTS =
  "ORGANIZATION_MEMBERSHIP_EXISTS" as const;

export function createOrganizationCreationPolicy(
  hasMembership: MembershipLookup,
) {
  return async (user: { id: string }) => !(await hasMembership(user.id));
}

export function createInvitationAcceptancePolicy(
  hasMembership: MembershipLookup,
) {
  return async ({ user }: { user: { id: string } }) => {
    if (!(await hasMembership(user.id))) return;

    throw new APIError("BAD_REQUEST", {
      code: ORGANIZATION_MEMBERSHIP_EXISTS,
      message: "Esta cuenta ya pertenece a un estudio.",
    });
  };
}

export async function normalizeOrganizationName(name: string) {
  const normalized = name.trim();

  if (normalized.length < 2 || normalized.length > 120) {
    throw new APIError("BAD_REQUEST", {
      message: "Organization name must contain between 2 and 120 characters",
    });
  }

  return normalized;
}
