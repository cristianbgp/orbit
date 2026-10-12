import { beforeEach, describe, expect, test, vi } from "vitest";

import {
  createTeamInvitationService,
  type TeamInvitationStore,
} from "../src/team-invitations/team-invitation-service";
import type {
  PendingTeamInvitation,
  TeamActor,
} from "../src/team-invitations/team-invitation-types";

const actor: TeamActor = { userId: "user-1", organizationId: "org-1" };
const invitations: PendingTeamInvitation[] = [
  {
    id: "invitation-1",
    email: "member@orbit.pe",
    role: "member",
    position: "senior",
    status: "pending",
    createdAt: new Date("2026-08-06T10:00:00.000Z"),
    expiresAt: new Date("2026-08-08T10:00:00.000Z"),
  },
];

describe("team invitation service", () => {
  let store: {
    getMembershipRole: ReturnType<typeof vi.fn>;
    listPending: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    store = {
      getMembershipRole: vi.fn().mockResolvedValue("owner"),
      listPending: vi.fn().mockResolvedValue(invitations),
    };
  });

  test("lists pending invitations for an organization owner", async () => {
    const service = createTeamInvitationService(store as TeamInvitationStore);

    await expect(service.listPending(actor)).resolves.toEqual(invitations);
    expect(store.getMembershipRole).toHaveBeenCalledWith("user-1", "org-1");
    expect(store.listPending).toHaveBeenCalledWith("org-1");
  });

  test.each(["member", null])(
    "rejects the role %j before reading invitations",
    async (role) => {
      store.getMembershipRole.mockResolvedValue(role);
      const service = createTeamInvitationService(store as TeamInvitationStore);

      await expect(service.listPending(actor)).rejects.toMatchObject({
        code: "FORBIDDEN",
      });
      expect(store.listPending).not.toHaveBeenCalled();
    },
  );
});
