import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";

import { useDebouncedValue } from "@/hooks/use-debounced-value";

describe("useDebouncedValue", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  test("publishes the latest value after 300 milliseconds by default", () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(
      ({ value }) => useDebouncedValue(value),
      { initialProps: { value: "initial" } },
    );

    rerender({ value: "updated" });
    act(() => vi.advanceTimersByTime(299));
    expect(result.current).toBe("initial");

    act(() => vi.advanceTimersByTime(1));
    expect(result.current).toBe("updated");
  });

  test("cancels a stale pending value", () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(
      ({ value }) => useDebouncedValue(value),
      { initialProps: { value: "" } },
    );

    rerender({ value: "Con" });
    act(() => vi.advanceTimersByTime(200));
    rerender({ value: "Constructora" });
    act(() => vi.advanceTimersByTime(100));
    expect(result.current).toBe("");

    act(() => vi.advanceTimersByTime(200));
    expect(result.current).toBe("Constructora");
  });
});
