import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { useCompactFilters } from "@/hooks/use-compact-filters";

function setViewportWidth(width: number) {
  Object.defineProperty(window, "innerWidth", {
    configurable: true,
    value: width,
  });
}

describe("useCompactFilters", () => {
  test("uses the compact filter surface below 1024px and updates on resize", async () => {
    setViewportWidth(820);
    const { result } = renderHook(() => useCompactFilters());

    await waitFor(() => expect(result.current).toBe(true));

    act(() => {
      setViewportWidth(1024);
      window.dispatchEvent(new Event("resize"));
    });

    expect(result.current).toBe(false);
  });

  test("keeps the desktop filter surface at the 1024px boundary", async () => {
    setViewportWidth(1024);
    const { result } = renderHook(() => useCompactFilters());

    await waitFor(() => expect(result.current).toBe(false));
  });
});
