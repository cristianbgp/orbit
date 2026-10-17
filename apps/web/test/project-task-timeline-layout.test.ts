import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";

import {
  DEFAULT_STAGE_WIDTH_PX,
  PROJECT_TIMELINE_STAGE_WIDTH_KEY,
  readTimelineStageWidth,
  useDesktopTimelineLayout,
  writeTimelineStageWidth,
} from "@/features/projects/project-task-timeline-layout";

function storageWith(value: string | null) {
  return {
    getItem: vi.fn(() => value),
    setItem: vi.fn(),
  };
}

describe("project task timeline layout", () => {
  afterEach(() => vi.unstubAllGlobals());

  test.each([
    ["280", 280],
    [null, DEFAULT_STAGE_WIDTH_PX],
    ["invalid", DEFAULT_STAGE_WIDTH_PX],
    ["179", DEFAULT_STAGE_WIDTH_PX],
    ["361", DEFAULT_STAGE_WIDTH_PX],
  ])("reads stored width %s as %s", (stored, expected) => {
    expect(readTimelineStageWidth(storageWith(stored))).toBe(expected);
  });

  test("tolerates blocked storage reads and writes", () => {
    const blocked = {
      getItem: vi.fn(() => {
        throw new Error("blocked");
      }),
      setItem: vi.fn(() => {
        throw new Error("blocked");
      }),
    };

    expect(readTimelineStageWidth(blocked)).toBe(DEFAULT_STAGE_WIDTH_PX);
    expect(() => writeTimelineStageWidth(260, blocked)).not.toThrow();
  });

  test("tolerates browsers that block access to localStorage itself", () => {
    vi.spyOn(window, "localStorage", "get").mockImplementation(() => {
      throw new DOMException("blocked", "SecurityError");
    });

    expect(readTimelineStageWidth).not.toThrow();
    expect(readTimelineStageWidth()).toBe(DEFAULT_STAGE_WIDTH_PX);
    expect(() => writeTimelineStageWidth(260)).not.toThrow();
  });

  test("writes only a valid stage width", () => {
    const storage = storageWith(null);

    writeTimelineStageWidth(260, storage);
    writeTimelineStageWidth(500, storage);

    expect(storage.setItem).toHaveBeenCalledOnce();
    expect(storage.setItem).toHaveBeenCalledWith(
      PROJECT_TIMELINE_STAGE_WIDTH_KEY,
      "260",
    );
  });

  test("tracks the desktop media query", () => {
    let matches = false;
    const listeners = new Set<(event: MediaQueryListEvent) => void>();
    vi.stubGlobal(
      "matchMedia",
      vi.fn(
        () =>
          ({
            get matches() {
              return matches;
            },
            media: "(min-width: 768px)",
            onchange: null,
            addEventListener: (
              _type: "change",
              listener: (event: MediaQueryListEvent) => void,
            ) => listeners.add(listener),
            removeEventListener: (
              _type: "change",
              listener: (event: MediaQueryListEvent) => void,
            ) => listeners.delete(listener),
            addListener: vi.fn(),
            removeListener: vi.fn(),
            dispatchEvent: vi.fn(),
          }) as MediaQueryList,
      ),
    );

    const { result } = renderHook(() => useDesktopTimelineLayout());
    expect(result.current).toBe(false);

    act(() => {
      matches = true;
      for (const listener of listeners) {
        listener({ matches } as MediaQueryListEvent);
      }
    });

    expect(result.current).toBe(true);
  });
});
