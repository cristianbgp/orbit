import { describe, expect, test } from "vitest";

import { readServerConfig } from "../src/config";

const validEnvironment = {
  DATABASE_URL: "postgres://localhost:5432/orbit_test",
  BETTER_AUTH_SECRET: "test-secret-with-at-least-32-characters",
};

describe("readServerConfig", () => {
  test("returns local URL defaults with required auth settings", () => {
    expect(readServerConfig(validEnvironment)).toEqual({
      port: 3000,
      allowedOrigin: "http://localhost:5173",
      url: "http://localhost:3000",
      databaseUrl: validEnvironment.DATABASE_URL,
      authSecret: validEnvironment.BETTER_AUTH_SECRET,
      trustSignupEmail: false,
      apiDocsEnabled: false,
      groqApiKey: undefined,
      orbitHelpModel: "openai/gpt-oss-20b",
    });
  });

  test("honors supplied server and auth values", () => {
    expect(
      readServerConfig({
        ...validEnvironment,
        PORT: "4100",
        API_URL: "https://api.orbit.pe",
        CORS_ALLOWED_ORIGIN: "https://app.orbit.pe",
        DATABASE_URL: "postgres://railway.internal:5432/orbit",
        BETTER_AUTH_SECRET: "another-secret-with-at-least-32-characters",
        AUTH_TRUST_SIGNUP_EMAIL: "true",
        GROQ_API_KEY: "groq-test-key",
        ORBIT_HELP_MODEL: "custom-help-model",
      }),
    ).toEqual({
      port: 4100,
      url: "https://api.orbit.pe",
      allowedOrigin: "https://app.orbit.pe",
      databaseUrl: "postgres://railway.internal:5432/orbit",
      authSecret: "another-secret-with-at-least-32-characters",
      trustSignupEmail: true,
      apiDocsEnabled: false,
      groqApiKey: "groq-test-key",
      orbitHelpModel: "custom-help-model",
    });
  });

  test("enables API documentation only for an exact true opt-in", () => {
    expect(
      readServerConfig({ ...validEnvironment, API_DOCS_ENABLED: "true" })
        .apiDocsEnabled,
    ).toBe(true);
    expect(
      readServerConfig({ ...validEnvironment, API_DOCS_ENABLED: "false" })
        .apiDocsEnabled,
    ).toBe(false);
    expect(
      readServerConfig({ ...validEnvironment, API_DOCS_ENABLED: "TRUE" })
        .apiDocsEnabled,
    ).toBe(false);
  });

  test("trusts signup email only for an exact true opt-in", () => {
    expect(
      readServerConfig({ ...validEnvironment, AUTH_TRUST_SIGNUP_EMAIL: "true" })
        .trustSignupEmail,
    ).toBe(true);
    expect(
      readServerConfig({
        ...validEnvironment,
        AUTH_TRUST_SIGNUP_EMAIL: "false",
      }).trustSignupEmail,
    ).toBe(false);
    expect(
      readServerConfig({ ...validEnvironment, AUTH_TRUST_SIGNUP_EMAIL: "TRUE" })
        .trustSignupEmail,
    ).toBe(false);
  });

  test("derives the local API URL from a custom port when omitted", () => {
    expect(readServerConfig({ ...validEnvironment, PORT: "4100" }).url).toBe(
      "http://localhost:4100",
    );
  });

  test("rejects an invalid port", () => {
    expect(() =>
      readServerConfig({ ...validEnvironment, PORT: "invalid" }),
    ).toThrow("Invalid PORT");
  });

  test.each([
    ["API_URL", "ftp://api.orbit.pe", "Invalid API_URL"],
    ["CORS_ALLOWED_ORIGIN", "app.orbit.pe", "Invalid CORS_ALLOWED_ORIGIN"],
  ])("rejects invalid %s values", (field, value, message) => {
    expect(() =>
      readServerConfig({ ...validEnvironment, [field]: value }),
    ).toThrow(message);
  });

  test("requires a database connection", () => {
    expect(() =>
      readServerConfig({
        BETTER_AUTH_SECRET: validEnvironment.BETTER_AUTH_SECRET,
      }),
    ).toThrow("Missing DATABASE_URL");
  });

  test("requires a strong Better Auth secret", () => {
    expect(() =>
      readServerConfig({ DATABASE_URL: validEnvironment.DATABASE_URL }),
    ).toThrow("Invalid BETTER_AUTH_SECRET");

    expect(() =>
      readServerConfig({
        ...validEnvironment,
        BETTER_AUTH_SECRET: "too-short",
      }),
    ).toThrow("Invalid BETTER_AUTH_SECRET");
  });
});
