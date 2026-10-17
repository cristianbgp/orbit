import { describe, expect, test } from "vitest";

import {
  getActiveUserInvitations,
  type UserInvitation,
} from "@/features/invitations/user-invitation-policy";

const now = new Date("2026-08-06T12:00:00.000Z");

function invitation(
  overrides: Partial<UserInvitation> & Pick<UserInvitation, "id">,
): UserInvitation {
  const { id, ...rest } = overrides;
  return {
    id,
    organizationName: "Estudio Orbit",
    status: "pending",
    createdAt: "2026-08-05T12:00:00.000Z",
    expiresAt: "2026-08-07T12:00:00.000Z",
    ...rest,
  };
}

describe("getActiveUserInvitations", () => {
  test("keeps only pending invitations that expire after now", () => {
    const invitations = [
      invitation({ id: "active" }),
      invitation({
        id: "expired",
        expiresAt: "2026-08-05T12:00:00.000Z",
      }),
      invitation({ id: "accepted", status: "accepted" }),
    ];

    expect(
      getActiveUserInvitations(invitations, now).map(({ id }) => id),
    ).toEqual(["active"]);
  });

  test("does not let boundary or invalid expirations block onboarding", () => {
    const invitations = [
      invitation({ id: "boundary", expiresAt: now }),
      invitation({ id: "invalid", expiresAt: "not-a-date" }),
    ];

    expect(getActiveUserInvitations(invitations, now)).toEqual([]);
  });
});
