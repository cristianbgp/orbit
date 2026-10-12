import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { useFeatureFlag } from "@/features/feature-flags/use-feature-flag";

const mocks = vi.hoisted(() => ({
  options: undefined as unknown,
  query: {
    data: undefined as
      undefined | { features: { orbitHelpAssistant: boolean } },
    isPending: true,
    isError: false,
  },
}));

vi.mock("@/lib/api/generated/feature-flags/feature-flags", () => ({
  useGetFeatureFlags: (options: unknown) => {
    mocks.options = options;
    return mocks.query;
  },
}));

const identity = { userId: "user-1", organizationId: "org-1" };

describe("useFeatureFlag", () => {
  beforeEach(() => {
    mocks.options = undefined;
    mocks.query.data = undefined;
    mocks.query.isPending = true;
    mocks.query.isError = false;
  });

  test("fails closed while flags are pending", () => {
    const { result } = renderHook(() =>
      useFeatureFlag("orbitHelpAssistant", identity),
    );

    expect(result.current).toBe(false);
  });

  test("fails closed when loading flags fails", () => {
    mocks.query.isPending = false;
    mocks.query.isError = true;

    const { result } = renderHook(() =>
      useFeatureFlag("orbitHelpAssistant", identity),
    );

    expect(result.current).toBe(false);
  });

  test("returns the resolved flag value", () => {
    mocks.query.isPending = false;
    mocks.query.data = { features: { orbitHelpAssistant: false } };
    const disabled = renderHook(() =>
      useFeatureFlag("orbitHelpAssistant", identity),
    );
    expect(disabled.result.current).toBe(false);

    mocks.query.data = { features: { orbitHelpAssistant: true } };
    const enabled = renderHook(() =>
      useFeatureFlag("orbitHelpAssistant", identity),
    );
    expect(enabled.result.current).toBe(true);
  });

  test("scopes the shared query cache to the current identity", () => {
    renderHook(() => useFeatureFlag("orbitHelpAssistant", identity));

    expect(mocks.options).toEqual({
      query: {
        queryKey: ["/api/features", identity],
        staleTime: 5 * 60 * 1000,
      },
    });
  });
});
