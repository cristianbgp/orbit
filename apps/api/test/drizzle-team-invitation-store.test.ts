import { describe, expect, test, vi } from "vitest";

import { createDrizzleTeamInvitationStore } from "../src/team-invitations/drizzle-team-invitation-store";

describe("Drizzle team invitation store", () => {
  test("reads the membership role and pending invitations", async () => {
    const roleLimit = vi.fn().mockResolvedValue([{ role: "owner" }]);
    const roleWhere = vi.fn(() => ({ limit: roleLimit }));
    const roleFrom = vi.fn(() => ({ where: roleWhere }));
    const invitationOrderBy = vi.fn().mockResolvedValue([
      {
        id: "invitation-1",
        email: "member@orbit.pe",
        role: null,
        status: "pending",
        createdAt: new Date("2026-08-06T10:00:00.000Z"),
        expiresAt: new Date("2026-08-08T10:00:00.000Z"),
      },
    ]);
    const invitationWhere = vi.fn(() => ({ orderBy: invitationOrderBy }));
    const invitationFrom = vi.fn(() => ({ where: invitationWhere }));
    const select = vi
      .fn()
      .mockReturnValueOnce({ from: roleFrom })
      .mockReturnValueOnce({ from: invitationFrom });
    const store = createDrizzleTeamInvitationStore({ select } as never);

    await expect(store.getMembershipRole("user-1", "org-1")).resolves.toBe(
      "owner",
    );
    await expect(store.listPending("org-1")).resolves.toEqual([
      {
        id: "invitation-1",
        email: "member@orbit.pe",
        role: "member",
        position: null,
        status: "pending",
        createdAt: new Date("2026-08-06T10:00:00.000Z"),
        expiresAt: new Date("2026-08-08T10:00:00.000Z"),
      },
    ]);
    expect(roleLimit).toHaveBeenCalledWith(1);
    expect(invitationOrderBy).toHaveBeenCalledOnce();
  });
});
