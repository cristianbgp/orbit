import { createElement, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";

import { useApiHealth } from "@/features/system-status/use-api-health";
import { getGetHealthQueryKey } from "@/lib/api/generated/system/system";

function createWrapper(queryClient: QueryClient) {
  return function QueryWrapper({ children }: { children: ReactNode }) {
    return createElement(
      QueryClientProvider,
      { client: queryClient },
      children,
    );
  };
}

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        gcTime: Infinity,
      },
    },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("useApiHealth", () => {
  test("uses the generated health query and returns its payload", async () => {
    const fetcher = vi.fn(async () =>
      Response.json({ status: "ok", service: "orbit-api" }),
    );
    vi.stubGlobal("fetch", fetcher);
    const queryClient = createQueryClient();

    const { result } = renderHook(() => useApiHealth(), {
      wrapper: createWrapper(queryClient),
    });

    expect(result.current.queryKey).toEqual(getGetHealthQueryKey());
    await waitFor(() => expect(result.current.isSuccess).toBe(true), {
      timeout: 2_500,
    });
    expect(result.current.data).toEqual({
      status: "ok",
      service: "orbit-api",
    });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  test("retries one retryable failure", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(null, { status: 503 }))
      .mockResolvedValueOnce(
        Response.json({ status: "ok", service: "orbit-api" }),
      );
    vi.stubGlobal("fetch", fetcher);
    const queryClient = createQueryClient();

    const { result } = renderHook(() => useApiHealth(), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true), {
      timeout: 2_500,
    });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
});
