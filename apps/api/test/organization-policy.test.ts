import { describe, expect, test, vi } from "vitest";

import {
  createInvitationAcceptancePolicy,
  createOrganizationCreationPolicy,
  normalizeOrganizationName,
  ORGANIZATION_MEMBERSHIP_EXISTS,
} from "../src/auth/organization-policy";

describe("organization creation policy", () => {
  test("allows a user without a membership", async () => {
    const lookup = vi.fn().mockResolvedValue(false);
    const canCreate = createOrganizationCreationPolicy(lookup);

    await expect(canCreate({ id: "user-1" })).resolves.toBe(true);
    expect(lookup).toHaveBeenCalledWith("user-1");
  });

  test("rejects a user who already has a membership", async () => {
    const canCreate = createOrganizationCreationPolicy(
      vi.fn().mockResolvedValue(true),
    );

    await expect(canCreate({ id: "user-1" })).resolves.toBe(false);
  });

  test.each(["", " ", "a", "x".repeat(121)])(
    "rejects the invalid name %j",
    async (name) => {
      await expect(normalizeOrganizationName(name)).rejects.toThrow(
        "Organization name must contain between 2 and 120 characters",
      );
    },
  );

  test("trims a valid organization name", async () => {
    await expect(normalizeOrganizationName("  Orbit Legal  ")).resolves.toBe(
      "Orbit Legal",
    );
  });
});

describe("invitation acceptance policy", () => {
  test("rejects an account that already belongs to a studio", async () => {
    const lookup = vi.fn().mockResolvedValue(true);
    const beforeAccept = createInvitationAcceptancePolicy(lookup);

    await expect(
      beforeAccept({ user: { id: "user-1" } }),
    ).rejects.toMatchObject({
      body: { code: ORGANIZATION_MEMBERSHIP_EXISTS },
    });
    expect(lookup).toHaveBeenCalledWith("user-1");
  });

  test("allows an account without a studio", async () => {
    const beforeAccept = createInvitationAcceptancePolicy(
      vi.fn().mockResolvedValue(false),
    );

    await expect(
      beforeAccept({ user: { id: "user-1" } }),
    ).resolves.toBeUndefined();
  });
});
