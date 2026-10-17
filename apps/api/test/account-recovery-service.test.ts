import { describe, expect, test, vi } from "vitest";

import {
  AccountRecoveryServiceError,
  createAccountRecoveryService,
} from "../src/account-recovery/account-recovery-service";
import type {
  AccountRecoveryContext,
  AccountRecoveryStore,
} from "../src/account-recovery/account-recovery-types";
import type { PasswordResetLinkIssuer } from "../src/auth/types";

const context: AccountRecoveryContext = {
  organizationId: "org-1",
  actor: {
    userId: "owner-1",
    name: "Olivia Owner",
    role: "owner",
  },
  subject: {
    userId: "user-2",
    name: "Ana Torres",
    email: "ana@orbit.pe",
  },
};

function dependencies(
  overrides: {
    target?: AccountRecoveryContext | null;
    operationalTarget?: AccountRecoveryContext | null;
    issue?: PasswordResetLinkIssuer["issue"];
  } = {},
) {
  const store: AccountRecoveryStore = {
    getTarget: vi
      .fn()
      .mockResolvedValue(
        overrides.target === undefined ? context : overrides.target,
      ),
    findOperationalTarget: vi
      .fn()
      .mockResolvedValue(
        overrides.operationalTarget === undefined
          ? { ...context, actor: null }
          : overrides.operationalTarget,
      ),
    recordGenerated: vi.fn().mockResolvedValue(undefined),
    recordCompleted: vi.fn().mockResolvedValue(undefined),
  };
  const issuer: PasswordResetLinkIssuer = {
    issue:
      overrides.issue ??
      vi.fn<PasswordResetLinkIssuer["issue"]>().mockResolvedValue({
        url: "https://app.orbit.pe/reset-password?token=secret",
        expiresAt: new Date("2026-08-18T15:30:00.000Z"),
      }),
  };
  return { store, issuer };
}

describe("account recovery service", () => {
  test("lets an owner generate and audit a link for an active studio member", async () => {
    const { store, issuer } = dependencies();
    const service = createAccountRecoveryService({ store, issuer });

    await expect(
      service.generateForMember(
        { userId: "owner-1", organizationId: "org-1" },
        "user-2",
      ),
    ).resolves.toEqual({
      url: "https://app.orbit.pe/reset-password?token=secret",
      expiresAt: new Date("2026-08-18T15:30:00.000Z"),
    });
    expect(store.getTarget).toHaveBeenCalledWith(
      { userId: "owner-1", organizationId: "org-1" },
      "user-2",
    );
    expect(issuer.issue).toHaveBeenCalledWith({ email: "ana@orbit.pe" });
    expect(store.recordGenerated).toHaveBeenCalledWith(context);
  });

  test("rejects active non-owner actors before issuing a link", async () => {
    const { store, issuer } = dependencies({
      target: {
        ...context,
        actor: { ...context.actor!, role: "member" },
      },
    });
    const service = createAccountRecoveryService({ store, issuer });

    await expect(
      service.generateForMember(
        { userId: "member-1", organizationId: "org-1" },
        "user-2",
      ),
    ).rejects.toEqual(
      new AccountRecoveryServiceError(
        "FORBIDDEN",
        "Solo el propietario puede generar enlaces de recuperación.",
      ),
    );
    expect(issuer.issue).not.toHaveBeenCalled();
    expect(store.recordGenerated).not.toHaveBeenCalled();
  });

  test("hides missing and cross-organization targets", async () => {
    const { store, issuer } = dependencies({ target: null });
    const service = createAccountRecoveryService({ store, issuer });

    await expect(
      service.generateForMember(
        { userId: "owner-1", organizationId: "org-1" },
        "foreign-user",
      ),
    ).rejects.toEqual(
      new AccountRecoveryServiceError("NOT_FOUND", "Miembro no encontrado."),
    );
    expect(issuer.issue).not.toHaveBeenCalled();
  });

  test("maps link generation failures to a safe unavailable error", async () => {
    const issue = vi
      .fn<PasswordResetLinkIssuer["issue"]>()
      .mockRejectedValue(new Error("token=secret database unavailable"));
    const { store, issuer } = dependencies({ issue });
    const service = createAccountRecoveryService({ store, issuer });

    await expect(
      service.generateForMember(
        { userId: "owner-1", organizationId: "org-1" },
        "user-2",
      ),
    ).rejects.toEqual(
      new AccountRecoveryServiceError(
        "UNAVAILABLE",
        "No pudimos generar el enlace de recuperación.",
      ),
    );
    expect(store.recordGenerated).not.toHaveBeenCalled();
  });

  test("normalizes one exact email for operational recovery", async () => {
    const { store, issuer } = dependencies();
    const service = createAccountRecoveryService({ store, issuer });

    await service.generateOperationally("  ANA@ORBIT.PE ");

    expect(store.findOperationalTarget).toHaveBeenCalledWith("ana@orbit.pe");
    expect(issuer.issue).toHaveBeenCalledWith({ email: "ana@orbit.pe" });
    expect(store.recordGenerated).toHaveBeenCalledWith({
      ...context,
      actor: null,
    });
  });

  test("records a completed Better Auth password reset", async () => {
    const { store, issuer } = dependencies();
    const service = createAccountRecoveryService({ store, issuer });

    await service.recordCompletion(context.subject);

    expect(store.recordCompleted).toHaveBeenCalledWith(context.subject);
  });
});
