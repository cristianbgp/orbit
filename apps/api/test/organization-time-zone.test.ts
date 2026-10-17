import { describe, expect, test } from "vitest";

import {
  DEFAULT_ORGANIZATION_TIME_ZONE,
  calendarDateInTimeZone,
  clampCalendarDate,
} from "../src/organizations/organization-time-zone";

describe("organization timezone", () => {
  test("uses America/Lima as the initial studio timezone", () => {
    expect(DEFAULT_ORGANIZATION_TIME_ZONE).toBe("America/Lima");
  });

  test("derives the Lima calendar day on both sides of UTC midnight", () => {
    expect(
      calendarDateInTimeZone(
        new Date("2026-08-07T00:30:00.000Z"),
        "America/Lima",
      ),
    ).toBe("2026-08-06");
    expect(
      calendarDateInTimeZone(
        new Date("2026-08-07T05:30:00.000Z"),
        "America/Lima",
      ),
    ).toBe("2026-08-07");
  });

  test("clamps a calendar date to its valid scheduling range", () => {
    expect(clampCalendarDate("2026-08-01", "2026-08-06", null)).toBe(
      "2026-08-06",
    );
    expect(clampCalendarDate("2026-08-20", "2026-08-06", "2026-08-14")).toBe(
      "2026-08-14",
    );
    expect(clampCalendarDate("2026-08-10", "2026-08-06", "2026-08-14")).toBe(
      "2026-08-10",
    );
  });
});
