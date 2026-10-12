const DEFAULT_PORT = 3000;
const DEFAULT_ALLOWED_ORIGIN = "http://localhost:5173";

export type ServerConfig = {
  port: number;
  allowedOrigin: string;
  url: string;
  databaseUrl: string;
  authSecret: string;
  trustSignupEmail: boolean;
  apiDocsEnabled: boolean;
  groqApiKey?: string;
  orbitHelpModel: string;
};

function readHttpUrl(value: string, field: string) {
  try {
    const url = new URL(value);

    if (url.protocol !== "http:" && url.protocol !== "https:") {
      throw new Error();
    }

    return url.origin;
  } catch {
    throw new Error(`Invalid ${field}`);
  }
}

export function readServerConfig(
  environment: Record<string, string | undefined> = process.env,
): ServerConfig {
  const port = Number(environment.PORT ?? DEFAULT_PORT);
  const databaseUrl = environment.DATABASE_URL;
  const authSecret = environment.BETTER_AUTH_SECRET;

  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error("Invalid PORT");
  }

  if (!databaseUrl) {
    throw new Error("Missing DATABASE_URL");
  }

  if (!authSecret || authSecret.length < 32) {
    throw new Error("Invalid BETTER_AUTH_SECRET");
  }

  return {
    port,
    allowedOrigin: readHttpUrl(
      environment.CORS_ALLOWED_ORIGIN ?? DEFAULT_ALLOWED_ORIGIN,
      "CORS_ALLOWED_ORIGIN",
    ),
    url: readHttpUrl(
      environment.API_URL ?? `http://localhost:${port}`,
      "API_URL",
    ),
    databaseUrl,
    authSecret,
    trustSignupEmail: environment.AUTH_TRUST_SIGNUP_EMAIL === "true",
    apiDocsEnabled: environment.API_DOCS_ENABLED === "true",
    groqApiKey: environment.GROQ_API_KEY,
    orbitHelpModel:
      environment.ORBIT_HELP_MODEL?.trim() || "openai/gpt-oss-20b",
  };
}
