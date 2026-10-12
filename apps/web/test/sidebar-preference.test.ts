import { describe, expect, test, vi } from "vitest";

import {
  readSidebarPreference,
  SIDEBAR_PREFERENCE_KEY,
  writeSidebarPreference,
} from "@/features/layout/sidebar-preference";

describe("sidebar preference", () => {
  test.each([
    [null, "expanded"],
    ["expanded", "expanded"],
    ["collapsed", "collapsed"],
    ["open", "expanded"],
  ] as const)("reads %s as %s", (stored, expected) => {
    const storage = {
      getItem: vi.fn().mockReturnValue(stored),
      setItem: vi.fn(),
    };

    expect(readSidebarPreference(storage)).toBe(expected);
    expect(storage.getItem).toHaveBeenCalledWith(SIDEBAR_PREFERENCE_KEY);
  });

  test("defaults to expanded when reading storage throws", () => {
    const storage = {
      getItem: vi.fn(() => {
        throw new DOMException("denied", "SecurityError");
      }),
      setItem: vi.fn(),
    };

    expect(readSidebarPreference(storage)).toBe("expanded");
  });

  test("ignores unavailable browser storage getters", () => {
    const browser = {} as Window & typeof globalThis;
    Object.defineProperty(browser, "localStorage", {
      get() {
        throw new DOMException("denied", "SecurityError");
      },
    });

    expect(readSidebarPreference(undefined, browser)).toBe("expanded");
    expect(() =>
      writeSidebarPreference("collapsed", undefined, browser),
    ).not.toThrow();
  });

  test("writes only the approved explicit state and tolerates failure", () => {
    const setItem = vi.fn(() => {
      throw new DOMException("denied", "SecurityError");
    });
    const storage = { getItem: vi.fn(), setItem };

    expect(() => writeSidebarPreference("collapsed", storage)).not.toThrow();
    expect(setItem).toHaveBeenCalledWith(SIDEBAR_PREFERENCE_KEY, "collapsed");
  });
});
