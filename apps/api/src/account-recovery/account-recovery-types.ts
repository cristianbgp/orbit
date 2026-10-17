import type { PasswordResetLinkIssuer } from "../auth/types";

export type AccountRecoveryActor = {
  userId: string;
  organizationId: string;
};

export type AccountRecoverySubject = {
  userId: string;
  name: string;
  email: string;
};

export type AccountRecoveryContext = {
  organizationId: string;
  actor: {
    userId: string;
    name: string;
    role: string;
  } | null;
  subject: AccountRecoverySubject;
};

export type AccountRecoveryStore = {
  getTarget(
    actor: AccountRecoveryActor,
    subjectUserId: string,
  ): Promise<AccountRecoveryContext | null>;
  findOperationalTarget(email: string): Promise<AccountRecoveryContext | null>;
  recordGenerated(context: AccountRecoveryContext): Promise<void>;
  recordCompleted(subject: AccountRecoverySubject): Promise<void>;
};

export type AccountRecoveryDependencies = {
  store: AccountRecoveryStore;
  issuer: PasswordResetLinkIssuer;
};
