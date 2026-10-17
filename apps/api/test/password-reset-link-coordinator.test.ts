import { describe, expect, test, vi } from "vitest";

import { createPasswordResetLinkCoordinator } from "../src/auth/password-reset-link-coordinator";

const input = {
  email: "ana@orbit.pe",
  redirectTo: "https://app.orbit.pe/reset-password",
};

describe("password reset link coordinator", () => {
  test("captures one reset link for a registered internal request", async () => {
    const coordinator = createPasswordResetLinkCoordinator({
      now: () => new Date("2026-08-18T15:00:00.000Z"),
      randomId: () => "nonce-1",
    });

    const result = await coordinator.issue(async (nonce) => {
      expect(
        coordinator.capture(
          nonce,
          "https://app.orbit.pe/reset-password?token=secret",
        ),
      ).toBe(true);
      expect(
        coordinator.capture(
          nonce,
          "https://app.orbit.pe/reset-password?token=second",
        ),
      ).toBe(false);
    }, input);

    expect(result).toEqual({
      url: "https://app.orbit.pe/reset-password?token=secret",
      expiresAt: new Date("2026-08-18T15:30:00.000Z"),
    });
    expect(
      coordinator.capture(
        "nonce-1",
        "https://app.orbit.pe/reset-password?token=late",
      ),
    ).toBe(false);
  });

  test("keeps concurrent internal requests isolated by nonce", async () => {
    const ids = ["nonce-a", "nonce-b"];
    const coordinator = createPasswordResetLinkCoordinator({
      randomId: () => ids.shift() ?? "unexpected",
    });
    const releases: Array<() => void> = [];

    const first = coordinator.issue(
      (nonce) =>
        new Promise<void>((resolve) => {
          releases.push(() => {
            coordinator.capture(
              nonce,
              "https://app.orbit.pe/reset-password?token=first",
            );
            resolve();
          });
        }),
      input,
    );
    const second = coordinator.issue(
      (nonce) =>
        new Promise<void>((resolve) => {
          releases.push(() => {
            coordinator.capture(
              nonce,
              "https://app.orbit.pe/reset-password?token=second",
            );
            resolve();
          });
        }),
      { ...input, email: "beatriz@orbit.pe" },
    );

    releases[1]?.();
    releases[0]?.();

    await expect(first).resolves.toMatchObject({
      url: "https://app.orbit.pe/reset-password?token=first",
    });
    await expect(second).resolves.toMatchObject({
      url: "https://app.orbit.pe/reset-password?token=second",
    });
  });

  test("rejects missing or malformed callback links without leaking inputs", async () => {
    const coordinator = createPasswordResetLinkCoordinator({
      randomId: () => "nonce-missing",
    });

    expect(
      coordinator.capture(
        "foreign",
        "https://app.orbit.pe/reset-password?token=foreign-secret",
      ),
    ).toBe(false);
    await expect(
      coordinator.issue(async () => undefined, input),
    ).rejects.toThrow("Password reset link was not captured");
    expect(
      coordinator.capture(
        "nonce-missing",
        "https://app.orbit.pe/reset-password?token=late-secret",
      ),
    ).toBe(false);

    const malformed = coordinator.issue(async (nonce) => {
      expect(coordinator.capture(nonce, "not-a-url")).toBe(false);
    }, input);
    await expect(malformed).rejects.toThrow(
      "Password reset link was not captured",
    );

    try {
      await coordinator.issue(async () => undefined, input);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      expect(message).not.toContain(input.email);
      expect(message).not.toContain("secret");
    }
  });

  test("removes pending capture state when reset generation throws", async () => {
    const coordinator = createPasswordResetLinkCoordinator({
      randomId: () => "nonce-failed",
    });
    const failure = new Error("provider failed");
    const requestReset = vi.fn().mockRejectedValue(failure);

    await expect(coordinator.issue(requestReset, input)).rejects.toBe(failure);
    expect(
      coordinator.capture(
        "nonce-failed",
        "https://app.orbit.pe/reset-password?token=late-secret",
      ),
    ).toBe(false);
  });
});
