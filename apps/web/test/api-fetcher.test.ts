import { describe, expect, test, vi } from "vitest";

import {
  ApiClientError,
  createOrbitApiFetcher,
  shouldRetryApiRequest,
} from "@/lib/api/fetcher";

type Health = {
  status: "ok";
  service: "orbit-api";
};

function createFetcher(response: Response | Error) {
  return vi.fn(async () => {
    if (response instanceof Response) return response;
    throw response;
  }) as unknown as typeof fetch;
}

describe("Orbit API fetcher", () => {
  test("normalizes the base URL and preserves credentialed request options", async () => {
    const controller = new AbortController();
    const fetcher = createFetcher(
      Response.json({ status: "ok", service: "orbit-api" }),
    );
    const request = createOrbitApiFetcher({
      baseUrl: "http://localhost:3000/",
      fetcher,
    });

    await expect(
      request<Health>("/health", {
        headers: { "X-Test": "value" },
        signal: controller.signal,
      }),
    ).resolves.toEqual({ status: "ok", service: "orbit-api" });

    expect(fetcher).toHaveBeenCalledOnce();
    const [url, options] = (
      fetcher as unknown as {
        mock: { calls: [RequestInfo | URL, RequestInit?][] };
      }
    ).mock.calls[0];
    expect(url).toBe("http://localhost:3000/health");
    expect(options?.credentials).toBe("include");
    expect(options?.signal).toBe(controller.signal);
    expect(new Headers(options?.headers)).toEqual(
      new Headers({ Accept: "application/json", "X-Test": "value" }),
    );
  });

  test.each([
    [401, false],
    [429, false],
    [503, true],
  ])("classifies HTTP %s retryability", async (status, retryable) => {
    const request = createOrbitApiFetcher({
      baseUrl: "http://localhost:3000",
      fetcher: createFetcher(new Response(null, { status })),
    });

    await expect(request("/api/me")).rejects.toMatchObject({
      name: "ApiClientError",
      kind: "http",
      status,
      retryable,
    });
  });

  test("uses the safe Orbit message for a general rate-limit response", async () => {
    const request = createOrbitApiFetcher({
      baseUrl: "http://localhost:3000",
      fetcher: createFetcher(
        Response.json(
          {
            error: {
              code: "RATE_LIMITED",
              message: "untrusted backend details",
              retryAfterSeconds: 18,
            },
          },
          { status: 429, headers: { "Retry-After": "18" } },
        ),
      ),
    });

    await expect(request("/api/projects")).rejects.toMatchObject({
      name: "ApiClientError",
      kind: "http",
      status: 429,
      retryable: false,
      message:
        "Has realizado demasiadas solicitudes. Inténtalo nuevamente en un momento.",
    });
  });

  test("classifies network failures as retryable", async () => {
    const request = createOrbitApiFetcher({
      baseUrl: "http://localhost:3000",
      fetcher: createFetcher(new TypeError("network details")),
    });

    await expect(request("/health")).rejects.toMatchObject({
      name: "ApiClientError",
      kind: "network",
      retryable: true,
    });
  });

  test("does not retry an aborted request", async () => {
    const request = createOrbitApiFetcher({
      baseUrl: "http://localhost:3000",
      fetcher: createFetcher(new DOMException("Aborted", "AbortError")),
    });

    await expect(request("/health")).rejects.toMatchObject({
      name: "ApiClientError",
      kind: "network",
      retryable: false,
    });
  });

  test("rejects invalid JSON without retrying", async () => {
    const request = createOrbitApiFetcher({
      baseUrl: "http://localhost:3000",
      fetcher: createFetcher(
        new Response("not-json", {
          headers: { "Content-Type": "application/json" },
        }),
      ),
    });

    await expect(request("/health")).rejects.toMatchObject({
      name: "ApiClientError",
      kind: "invalid-response",
      retryable: false,
    });
  });

  test("accepts empty 204 responses as undefined", async () => {
    const request = createOrbitApiFetcher({
      baseUrl: "http://localhost:3000",
      fetcher: createFetcher(new Response(null, { status: 204 })),
    });

    await expect(request<void>("/api/stages/123")).resolves.toBeUndefined();
  });
});

describe("shouldRetryApiRequest", () => {
  test("allows only one retry for retryable API failures", () => {
    const error = new ApiClientError("Unavailable", {
      kind: "http",
      status: 503,
      retryable: true,
    });

    expect(shouldRetryApiRequest(0, error)).toBe(true);
    expect(shouldRetryApiRequest(1, error)).toBe(false);
  });

  test("does not retry ordinary errors", () => {
    expect(shouldRetryApiRequest(0, new Error("failure"))).toBe(false);
  });
});
