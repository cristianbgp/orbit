import { describe, expect, test } from "vitest";

import type { CaseEventCalendarItem } from "@/lib/api/generated/models";
import {
  getCaseEventCalendarVisibleRange,
  layoutCaseEventCalendar,
} from "./case-event-calendar-layout";

function event(
  id: string,
  date: string,
  title = `Informe ${id}`,
): CaseEventCalendarItem {
  return {
    id,
    title,
    type: "oral_argument",
    date,
    description: null,
    createdByUserId: "user-1",
    createdAt: "2026-09-01T10:00:00.000Z",
    updatedAt: "2026-09-01T10:00:00.000Z",
    case: {
      id: `case-${id}`,
      identification: `Caso ${id}`,
      status: "in_progress",
      type: "judicial",
      stage: "judicial_first_instance",
      docketNumber: null,
      client: { id: "client-1", name: "Cliente" },
    },
  };
}

describe("case event calendar layout", () => {
  test("builds complete Monday-first weeks around the selected month", () => {
    expect(getCaseEventCalendarVisibleRange("2026-09")).toEqual({
      from: "2026-08-31",
      to: "2026-10-04",
      dates: expect.arrayContaining(["2026-09-01", "2026-09-30"]),
    });
  });

  test("orders events and bounds daily entries with overflow", () => {
    const events = [
      event("6", "2026-09-17", "Zulu"),
      event("5", "2026-09-17", "Echo"),
      event("4", "2026-09-17", "Delta"),
      event("3", "2026-09-17", "Charlie"),
      event("2", "2026-09-17", "Bravo"),
      event("1", "2026-09-17", "Alpha"),
    ];

    const layout = layoutCaseEventCalendar(events, "2026-09", "2026-09-17");
    const day = layout.daysByDate["2026-09-17"]!;

    expect(day.events.map(({ title }) => title)).toEqual([
      "Alpha",
      "Bravo",
      "Charlie",
      "Delta",
      "Echo",
      "Zulu",
    ]);
    expect(day.visible).toHaveLength(4);
    expect(day.overflow).toBe(2);
    expect(day.isToday).toBe(true);
    expect(layout.daysByDate["2026-09-19"]?.isWeekend).toBe(true);
    expect(layout.daysByDate["2026-08-31"]?.outsideMonth).toBe(true);
  });
});
