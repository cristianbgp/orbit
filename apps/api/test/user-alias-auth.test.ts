import { beforeEach, describe, expect, test, vi } from "vitest";
import { getIP } from "@better-auth/core/utils/ip";

import { createOrbitAuth } from "../src/auth/create-auth";
import { isValidUserAlias } from "../src/identity/user-alias";

type CapturedAuthOptions = {
  user?: {
    additionalFields?: {
      alias?: { required?: boolean };
      avatarColor?: { required?: boolean };
    };
  };
  databaseHooks?: {
    user?: {
      create?: {
        before?: (candidate: {
          name: string;
          email: string;
          emailVerified: boolean;
        }) => Promise<{
          data: {
            alias?: string | null;
            avatarColor?: string;
            emailVerified?: boolean;
          };
        }>;
      };
    };
  };
};

const mocks = vi.hoisted(() => ({
  options: null as CapturedAuthOptions | null,
}));

vi.mock("@better-auth/drizzle-adapter", () => ({
  drizzleAdapter: () => ({}),
}));

vi.mock("better-auth/plugins", () => ({
  organization: () => ({ id: "organization" }),
}));

vi.mock("better-auth", () => ({
  betterAuth: (options: CapturedAuthOptions) => {
    mocks.options = options;
    return {
      handler: () => new Response(null),
      api: { getSession: async () => null },
    };
  },
}));

describe("Better Auth user alias persistence", () => {
  beforeEach(() => {
    mocks.options = null;
    createOrbitAuth({
      db: {} as never,
      baseURL: "http://localhost:3000",
      secret: "test-secret",
      trustedOrigin: "http://localhost:5173",
    });
  });

  test("keeps generated storage nullable for expand-contract compatibility", () => {
    expect(mocks.options?.user?.additionalFields?.alias?.required).toBe(false);
    expect(mocks.options?.user?.additionalFields?.avatarColor?.required).toBe(
      true,
    );
  });

  test("uses Railway's trusted single-value client IP header", () => {
    const request = new Request("https://api.orbit.pe/api/auth/get-session", {
      headers: {
        "x-forwarded-for": "198.51.100.24, 100.64.0.8",
        "x-real-ip": "198.51.100.24",
      },
    });

    expect(getIP(request, mocks.options as Parameters<typeof getIP>[1])).toBe(
      "198.51.100.24",
    );
  });

  test.each([
    ["Cristian Granda Pastora", "CGP"],
    ["Ana-María Pérez", "AMP"],
    ["---9 vidas", "9V"],
    ["Élodie Dupont", "ÉD"],
    ["ß X", "SSX"],
    ["½", "ORBIT"],
    ["²", "ORBIT"],
    ["௰", "ORBIT"],
    ["Q", "QQ"],
    ["", "ORBIT"],
    ["   ", "ORBIT"],
    ["!!!", "ORBIT"],
  ])("persists a valid generated alias for %j", async (name, expected) => {
    const before = mocks.options?.databaseHooks?.user?.create?.before;

    expect(before).toBeTypeOf("function");
    const result = await before!({
      name,
      email: `${expected}@orbit.test`,
      emailVerified: false,
    });
    expect(result.data.alias).toBe(expected);
    expect(isValidUserAlias(result.data.alias ?? "")).toBe(true);
    expect(result.data.avatarColor).toMatch(/^#[0-9a-f]{6}$/);
  });

  test("keeps Better Auth's unverified signup state by default", async () => {
    const before = mocks.options?.databaseHooks?.user?.create?.before;

    const result = await before!({
      name: "Ana Pérez",
      email: "ana@orbit.test",
      emailVerified: false,
    });

    expect(result.data.emailVerified).toBe(false);
  });

  test("marks new signup emails verified when explicitly trusted", async () => {
    createOrbitAuth({
      db: {} as never,
      baseURL: "http://localhost:3000",
      secret: "test-secret",
      trustedOrigin: "http://localhost:5173",
      trustSignupEmail: true,
    });
    const before = mocks.options?.databaseHooks?.user?.create?.before;

    const result = await before!({
      name: "Ana Pérez",
      email: "ana@orbit.test",
      emailVerified: false,
    });

    expect(result.data.emailVerified).toBe(true);
  });
});
