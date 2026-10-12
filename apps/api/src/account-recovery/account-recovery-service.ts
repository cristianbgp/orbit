import type { PasswordResetLink } from "../auth/types";
import type {
  AccountRecoveryActor,
  AccountRecoveryContext,
  AccountRecoveryDependencies,
  AccountRecoverySubject,
} from "./account-recovery-types";

export type AccountRecoveryServiceErrorCode =
  "FORBIDDEN" | "NOT_FOUND" | "UNAVAILABLE";

export class AccountRecoveryServiceError extends Error {
  readonly code: AccountRecoveryServiceErrorCode;

  constructor(code: AccountRecoveryServiceErrorCode, message: string) {
    super(message);
    this.name = "AccountRecoveryServiceError";
    this.code = code;
  }
}

export function createAccountRecoveryService({
  store,
  issuer,
}: AccountRecoveryDependencies) {
  async function issueAndAudit(
    context: AccountRecoveryContext,
  ): Promise<PasswordResetLink> {
    try {
      const link = await issuer.issue({ email: context.subject.email });
      await store.recordGenerated(context);
      return link;
    } catch {
      throw new AccountRecoveryServiceError(
        "UNAVAILABLE",
        "No pudimos generar el enlace de recuperación.",
      );
    }
  }

  return {
    async generateForMember(
      actor: AccountRecoveryActor,
      subjectUserId: string,
    ) {
      const context = await store.getTarget(actor, subjectUserId);
      if (!context) {
        throw new AccountRecoveryServiceError(
          "NOT_FOUND",
          "Miembro no encontrado.",
        );
      }
      if (context.actor?.role !== "owner") {
        throw new AccountRecoveryServiceError(
          "FORBIDDEN",
          "Solo el propietario puede generar enlaces de recuperación.",
        );
      }
      return issueAndAudit(context);
    },

    async generateOperationally(email: string) {
      const normalizedEmail = email.trim().toLocaleLowerCase("und");
      const context = await store.findOperationalTarget(normalizedEmail);
      if (!context) {
        throw new AccountRecoveryServiceError(
          "NOT_FOUND",
          "Usuario no encontrado.",
        );
      }
      return issueAndAudit(context);
    },

    recordCompletion(subject: AccountRecoverySubject) {
      return store.recordCompleted(subject);
    },
  };
}

export type AccountRecoveryService = ReturnType<
  typeof createAccountRecoveryService
>;
