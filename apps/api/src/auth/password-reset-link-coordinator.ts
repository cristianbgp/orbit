import type { PasswordResetLink } from "./types";

const PASSWORD_RESET_LINK_TTL_MS = 30 * 60 * 1_000;

export type PasswordResetLinkInput = {
  email: string;
  redirectTo: string;
};

type PendingCapture = { url: string | null };

type CoordinatorOptions = {
  now?: () => Date;
  randomId?: () => string;
};

function isResetUrl(value: string) {
  try {
    const url = new URL(value);
    return (
      (url.protocol === "https:" || url.protocol === "http:") &&
      url.pathname === "/reset-password"
    );
  } catch {
    return false;
  }
}

export function createPasswordResetLinkCoordinator(
  options: CoordinatorOptions = {},
) {
  const now = options.now ?? (() => new Date());
  const randomId = options.randomId ?? (() => crypto.randomUUID());
  const pending = new Map<string, PendingCapture>();

  return {
    capture(nonce: string, url: string) {
      const request = pending.get(nonce);
      if (!request || request.url !== null || !isResetUrl(url)) return false;
      request.url = url;
      return true;
    },

    async issue(
      requestReset: (
        nonce: string,
        input: PasswordResetLinkInput,
      ) => Promise<void>,
      input: PasswordResetLinkInput,
    ): Promise<PasswordResetLink> {
      const nonce = randomId();
      const request: PendingCapture = { url: null };
      pending.set(nonce, request);
      try {
        await requestReset(nonce, input);
        if (!request.url) {
          throw new Error("Password reset link was not captured");
        }
        return {
          url: request.url,
          expiresAt: new Date(now().getTime() + PASSWORD_RESET_LINK_TTL_MS),
        };
      } finally {
        pending.delete(nonce);
      }
    },
  };
}
