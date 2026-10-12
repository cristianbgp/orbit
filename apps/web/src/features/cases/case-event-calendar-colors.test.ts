import { describe, expect, test } from "vitest";

import { caseEventCalendarTone } from "./case-event-calendar-colors";

describe("case event calendar colors", () => {
  test("derives a stable accessible tone from the case id", () => {
    expect(caseEventCalendarTone("case-1")).toEqual(
      caseEventCalendarTone("case-1"),
    );
    expect(caseEventCalendarTone("case-1")).toHaveProperty("border");
    expect(caseEventCalendarTone("case-1")).toHaveProperty("text");
  });
});
