import { beforeEach, describe, expect, test, vi } from "vitest";

import { createOrbitAuth } from "../src/auth/create-auth";

type ResetUser = { id: string; name: string; email: string };
type CapturedOptions = {
  emailAndPassword?: {
    enabled?: boolean;
    resetPasswordTokenExpiresIn?: number;
    revokeSessionsOnPasswordReset?: boolean;
    sendResetPassword?: (
      data: { user: ResetUser; url: string; token: string },
      request?: Request,
    ) => Promise<void> | void;
    onPasswordReset?: (
      data: { user: ResetUser },
      request?: Request,
    ) => Promise<void> | void;
  };
};

const mocks = vi.hoisted(() => ({
  options: null as CapturedOptions | null,
  requestPasswordReset: vi.fn(),
  handler: vi.fn(),
}));

vi.mock("@better-auth/drizzle-adapter", () => ({
  drizzleAdapter: () => ({}),
}));

vi.mock("better-auth/plugins", () => ({
  organization: () => ({ id: "organization" }),
}));

vi.mock("better-auth", () => ({
  betterAuth: (options: CapturedOptions) => {
    mocks.options = options;
    return {
      handler: mocks.handler,
      api: {
        getSession: async () => null,
        requestPasswordReset: mocks.requestPasswordReset,
      },
    };
  },
}));

const user = {
  id: "user-1",
  name: "Ana Torres",
  email: "ana@orbit.pe",
};

describe("Better Auth manual password reset configuration", () => {
  beforeEach(() => {
    mocks.options = null;
    mocks.requestPasswordReset.mockReset();
    mocks.handler.mockReset().mockImplementation(async (request: Request) => {
      await mocks.options?.emailAndPassword?.sendResetPassword?.(
        {
          user,
          token: "secret-token",
          url: "http://localhost:3000/api/auth/reset-password/secret-token?callbackURL=http%3A%2F%2Flocalhost%3A5173%2Freset-password",
        },
        request,
      );
      return Response.json({ status: true });
    });
  });

  test("uses a 30-minute token and revokes existing sessions", () => {
    createOrbitAuth({
      db: {} as never,
      baseURL: "http://localhost:3000",
      secret: "test-secret",
      trustedOrigin: "http://localhost:5173",
      webOrigin: "http://localhost:5173",
    });

    expect(mocks.options?.emailAndPassword).toMatchObject({
      enabled: true,
      resetPasswordTokenExpiresIn: 1_800,
      revokeSessionsOnPasswordReset: true,
    });
  });

  test("captures the Better Auth reset URL only for an internal issue call", async () => {
    const { passwordResetLinks } = createOrbitAuth({
      db: {} as never,
      baseURL: "http://localhost:3000",
      secret: "test-secret",
      trustedOrigin: "http://localhost:5173",
      webOrigin: "http://localhost:5173",
    });

    const result = await passwordResetLinks.issue({ email: user.email });

    expect(result.url).toBe(
      "http://localhost:5173/reset-password?token=secret-token",
    );
    expect(mocks.handler).toHaveBeenCalledOnce();
    const request = mocks.handler.mock.calls[0]?.[0] as Request;
    expect(request.url).toBe(
      "http://localhost:3000/api/auth/request-password-reset",
    );
    expect(request.method).toBe("POST");
    expect(request.headers.get("x-orbit-password-reset-request")).toMatch(
      /^[0-9a-f-]{36}$/,
    );
    expect(request.headers.get("origin")).toBe("http://localhost:5173");
    expect(request.headers.get("x-real-ip")).toBe("127.0.0.1");
    await expect(request.clone().json()).resolves.toEqual({
      email: user.email,
      redirectTo: "http://localhost:5173/reset-password",
    });
    expect(mocks.requestPasswordReset).not.toHaveBeenCalled();
  });

  test("does not expose a reset URL from an ordinary public request", async () => {
    createOrbitAuth({
      db: {} as never,
      baseURL: "http://localhost:3000",
      secret: "test-secret",
      trustedOrigin: "http://localhost:5173",
      webOrigin: "http://localhost:5173",
    });

    await expect(
      mocks.options?.emailAndPassword?.sendResetPassword?.(
        {
          user,
          token: "public-secret",
          url: "http://localhost:5173/reset-password?token=public-secret",
        },
        new Request("http://localhost:3000/api/auth/request-password-reset"),
      ),
    ).resolves.toBeUndefined();
  });

  test("reports a completed reset without passing its token", async () => {
    const onPasswordReset = vi.fn().mockResolvedValue(undefined);
    createOrbitAuth({
      db: {} as never,
      baseURL: "http://localhost:3000",
      secret: "test-secret",
      trustedOrigin: "http://localhost:5173",
      webOrigin: "http://localhost:5173",
      onPasswordReset,
    });

    await mocks.options?.emailAndPassword?.onPasswordReset?.(
      { user },
      new Request("http://localhost:3000/api/auth/reset-password"),
    );

    expect(onPasswordReset).toHaveBeenCalledWith(user);
  });

  test("does not report a failed reset after Better Auth already changed the password", async () => {
    const logError = vi.spyOn(console, "error").mockImplementation(() => {});
    const onPasswordReset = vi
      .fn()
      .mockRejectedValue(new Error("audit database unavailable"));
    createOrbitAuth({
      db: {} as never,
      baseURL: "http://localhost:3000",
      secret: "test-secret",
      trustedOrigin: "http://localhost:5173",
      webOrigin: "http://localhost:5173",
      onPasswordReset,
    });

    await expect(
      mocks.options?.emailAndPassword?.onPasswordReset?.({ user }),
    ).resolves.toBeUndefined();
    expect(logError).toHaveBeenCalledWith(
      "Account recovery completion audit could not be recorded",
    );
    expect(JSON.stringify(logError.mock.calls)).not.toContain(user.email);
    logError.mockRestore();
  });
});
