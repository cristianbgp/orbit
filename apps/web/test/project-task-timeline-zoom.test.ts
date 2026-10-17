import { describe, expect, test, vi } from "vitest";

import {
  anchoredTimelineScrollLeft,
  nextTimelineZoom,
  previousTimelineZoom,
  readTimelineZoomPreference,
  timelineEffectiveDayWidth,
  timelineFitDayWidth,
  TIMELINE_ZOOM_KEY,
  writeTimelineZoomPreference,
} from "@/features/projects/project-task-timeline-zoom";

function storageWith(value: string | null) {
  return {
    getItem: vi.fn(() => value),
    setItem: vi.fn(),
  };
}

describe("project task timeline zoom", () => {
  test("fits short periods and preserves a readable floor for long periods", () => {
    expect(timelineFitDayWidth(800, 10)).toBe(80);
    expect(timelineFitDayWidth(800, 40)).toBe(40);
    expect(timelineFitDayWidth(0, 10)).toBe(40);
    expect(timelineFitDayWidth(800, 0)).toBe(40);
  });

  test("uses the fit width as the lower bound for manual zoom", () => {
    expect(timelineEffectiveDayWidth("fit", 800, 10)).toBe(80);
    expect(timelineEffectiveDayWidth(56, 800, 10)).toBe(80);
    expect(timelineEffectiveDayWidth(112, 800, 10)).toBe(112);
  });

  test.each([
    { preference: "fit" as const, fitWidth: 60, expected: 80 },
    { preference: "fit" as const, fitWidth: 80, expected: 112 },
    { preference: 80 as const, fitWidth: 40, expected: 112 },
    { preference: 112 as const, fitWidth: 40, expected: 112 },
  ])("moves from $preference to the next useful zoom", (entry) => {
    expect(nextTimelineZoom(entry.preference, entry.fitWidth)).toBe(
      entry.expected,
    );
  });

  test.each([
    { preference: 112 as const, fitWidth: 60, expected: 80 },
    { preference: 80 as const, fitWidth: 60, expected: "fit" },
    { preference: 80 as const, fitWidth: 40, expected: 56 },
    { preference: 56 as const, fitWidth: 40, expected: "fit" },
    { preference: "fit" as const, fitWidth: 40, expected: "fit" },
  ])("moves from $preference to the previous useful zoom", (entry) => {
    expect(previousTimelineZoom(entry.preference, entry.fitWidth)).toBe(
      entry.expected,
    );
  });

  test.each([
    [null, "fit"],
    ["fit", "fit"],
    ["56", 56],
    ["80", 80],
    ["112", 112],
    ["64", "fit"],
    ["invalid", "fit"],
  ] as const)("reads stored value %s as %s", (stored, expected) => {
    const storage = storageWith(stored);

    expect(readTimelineZoomPreference(storage)).toBe(expected);
    expect(storage.getItem).toHaveBeenCalledWith(TIMELINE_ZOOM_KEY);
  });

  test("tolerates blocked storage access and writes explicit preferences", () => {
    const blocked = {
      getItem: vi.fn(() => {
        throw new DOMException("blocked", "SecurityError");
      }),
      setItem: vi.fn(() => {
        throw new DOMException("blocked", "SecurityError");
      }),
    };

    expect(readTimelineZoomPreference(blocked)).toBe("fit");
    expect(() => writeTimelineZoomPreference(80, blocked)).not.toThrow();
    expect(blocked.setItem).toHaveBeenCalledWith(TIMELINE_ZOOM_KEY, "80");
  });

  test("tolerates browsers that block the localStorage getter", () => {
    const browser = {} as Window & typeof globalThis;
    Object.defineProperty(browser, "localStorage", {
      get() {
        throw new DOMException("blocked", "SecurityError");
      },
    });

    expect(readTimelineZoomPreference(undefined, browser)).toBe("fit");
    expect(() =>
      writeTimelineZoomPreference("fit", undefined, browser),
    ).not.toThrow();
  });

  test("keeps the logical center day anchored and clamps boundaries", () => {
    expect(
      anchoredTimelineScrollLeft({
        oldScrollLeft: 400,
        viewportWidth: 600,
        oldDayWidth: 80,
        newDayWidth: 112,
        dayCount: 30,
      }),
    ).toBe(680);
    expect(
      anchoredTimelineScrollLeft({
        oldScrollLeft: 0,
        viewportWidth: 600,
        oldDayWidth: 80,
        newDayWidth: 40,
        dayCount: 10,
      }),
    ).toBe(0);
    expect(
      anchoredTimelineScrollLeft({
        oldScrollLeft: 1_900,
        viewportWidth: 600,
        oldDayWidth: 80,
        newDayWidth: 112,
        dayCount: 20,
      }),
    ).toBe(1_640);
  });

  test("keeps the center day anchored when the viewport width changes", () => {
    expect(
      anchoredTimelineScrollLeft({
        oldScrollLeft: 200,
        viewportWidth: 800,
        newViewportWidth: 1_000,
        oldDayWidth: 40,
        newDayWidth: 40,
        dayCount: 40,
      }),
    ).toBe(100);
  });
});
