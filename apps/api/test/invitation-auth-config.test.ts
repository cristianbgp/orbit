import { beforeEach, describe, expect, test, vi } from "vitest";

import {
  createOrbitAuth,
  DISABLED_INVITATION_LIST_PATH,
  INVITATION_EXPIRES_IN_SECONDS,
} from "../src/auth/create-auth";

type InvitationHookOptions = {
  organizationHooks?: {
    beforeCreateInvitation?(context: {
      invitation: { position?: string };
    }): Promise<{ data: { position: string } }>;
    afterAcceptInvitation?(context: {
      invitation: { position?: string | null };
      member: { id: string };
    }): Promise<void>;
  };
};

const mocks = vi.hoisted(() => ({
  organizationOptions: null as InvitationHookOptions | null,
  update: vi.fn(),
  set: vi.fn(),
  returning: vi.fn(),
}));

vi.mock("@better-auth/drizzle-adapter", () => ({
  drizzleAdapter: () => ({}),
}));

vi.mock("better-auth/plugins", () => ({
  organization: (options: InvitationHookOptions) => {
    mocks.organizationOptions = options;
    return { id: "organization" };
  },
}));

vi.mock("better-auth", () => ({
  betterAuth: () => ({
    handler: () => new Response(null),
    api: { getSession: async () => null },
  }),
}));

describe("team invitation auth configuration", () => {
  beforeEach(() => {
    mocks.organizationOptions = null;
    mocks.returning.mockReset().mockResolvedValue([{ id: "member-2" }]);
    mocks.set.mockReset().mockReturnValue({
      where: vi.fn().mockReturnValue({ returning: mocks.returning }),
    });
    mocks.update.mockReset().mockReturnValue({
      set: mocks.set,
    });

    createOrbitAuth({
      db: { update: mocks.update } as never,
      baseURL: "http://localhost:3000",
      secret: "test-secret-at-least-32-characters-long",
      trustedOrigin: "http://localhost:5173",
    });
  });

  test("uses an explicit 48-hour expiration", () => {
    expect(INVITATION_EXPIRES_IN_SECONDS).toBe(172_800);
  });

  test("disables Better Auth's member-readable invitation list", () => {
    expect(DISABLED_INVITATION_LIST_PATH).toBe(
      "/organization/list-invitations",
    );
  });

  test("requires a professional position on new invitations", async () => {
    const hook =
      mocks.organizationOptions?.organizationHooks?.beforeCreateInvitation;

    expect(hook).toBeTypeOf("function");
    await expect(
      hook!({ invitation: { position: "senior" } }),
    ).resolves.toEqual({ data: { position: "senior" } });
    await expect(hook!({ invitation: {} })).rejects.toThrow(
      "Invitation position is required",
    );
  });

  test("copies the invitation position to the accepted membership", async () => {
    const hook =
      mocks.organizationOptions?.organizationHooks?.afterAcceptInvitation;

    expect(hook).toBeTypeOf("function");
    await hook!({
      invitation: { position: "junior" },
      member: { id: "member-2" },
    });

    expect(mocks.update).toHaveBeenCalledOnce();
    expect(mocks.set).toHaveBeenCalledWith({ position: "junior" });
    expect(mocks.returning).toHaveBeenCalledOnce();
  });
});
