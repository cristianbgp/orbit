export type ApiClientErrorKind = "network" | "http" | "invalid-response";

const RATE_LIMITED_MESSAGE =
  "Has realizado demasiadas solicitudes. Inténtalo nuevamente en un momento.";

type ApiClientErrorOptions = {
  kind: ApiClientErrorKind;
  status?: number;
  retryable: boolean;
  cause?: unknown;
};

export class ApiClientError extends Error {
  readonly kind: ApiClientErrorKind;
  readonly status?: number;
  readonly retryable: boolean;

  constructor(message: string, options: ApiClientErrorOptions) {
    super(message, { cause: options.cause });
    this.name = "ApiClientError";
    this.kind = options.kind;
    this.status = options.status;
    this.retryable = options.retryable;
  }
}

type CreateOrbitApiFetcherOptions = {
  baseUrl: string;
  fetcher?: typeof fetch;
};

function isGeneralRateLimitResponse(value: unknown): boolean {
  if (!value || typeof value !== "object" || !("error" in value)) return false;
  const error = value.error;
  return Boolean(
    error &&
    typeof error === "object" &&
    "code" in error &&
    error.code === "RATE_LIMITED",
  );
}

async function getHttpErrorMessage(response: Response): Promise<string> {
  if (response.status === 429) {
    try {
      if (isGeneralRateLimitResponse(await response.json())) {
        return RATE_LIMITED_MESSAGE;
      }
    } catch {
      // Invalid error bodies fall back to the generic HTTP message.
    }
  }

  return `La API respondió con HTTP ${response.status}.`;
}

export function createOrbitApiFetcher(options: CreateOrbitApiFetcherOptions) {
  const { baseUrl, fetcher } = options;
  const normalizedBaseUrl = `${baseUrl.replace(/\/+$/, "")}/`;

  return async function request<T>(
    url: string,
    options: RequestInit = {},
  ): Promise<T> {
    const endpoint = new URL(url.replace(/^\/+/, ""), normalizedBaseUrl);
    const headers = new Headers(options.headers);
    let response: Response;

    if (!headers.has("Accept")) {
      headers.set("Accept", "application/json");
    }

    try {
      response = await (fetcher ?? globalThis.fetch)(endpoint.toString(), {
        ...options,
        credentials: "include",
        headers,
      });
    } catch (error) {
      const isAbort =
        error instanceof DOMException && error.name === "AbortError";

      throw new ApiClientError("No se pudo conectar con la API de Orbit.", {
        kind: "network",
        retryable: !isAbort,
        cause: error,
      });
    }

    if (!response.ok) {
      throw new ApiClientError(await getHttpErrorMessage(response), {
        kind: "http",
        status: response.status,
        retryable: response.status >= 500,
      });
    }

    const responseText = await response.text();
    if (!responseText) {
      return undefined as T;
    }

    try {
      return JSON.parse(responseText) as T;
    } catch (error) {
      throw new ApiClientError("La API devolvió una respuesta no válida.", {
        kind: "invalid-response",
        retryable: false,
        cause: error,
      });
    }
  };
}

export const orbitApiFetch = createOrbitApiFetcher({
  baseUrl: import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000",
});

export function shouldRetryApiRequest(failureCount: number, error: unknown) {
  return error instanceof ApiClientError && error.retryable && failureCount < 1;
}
