import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import {
  OrganizationCalendarProvider,
  useOrganizationCalendar,
} from "@/features/organization/organization-calendar-context";

function CalendarProbe() {
  const calendar = useOrganizationCalendar();
  return <output>{`${calendar.today}|${calendar.timeZone}`}</output>;
}

describe("OrganizationCalendarProvider", () => {
  test.each([
    ["America/Lima", "2026-08-11|America/Lima"],
    ["UTC", "2026-08-12|UTC"],
  ])("derives today in %s", (timeZone, expected) => {
    render(
      <OrganizationCalendarProvider
        timeZone={timeZone}
        now={new Date("2026-08-12T03:00:00.000Z")}
      >
        <CalendarProbe />
      </OrganizationCalendarProvider>,
    );

    expect(screen.getByText(expected)).toBeInTheDocument();
  });

  test("rejects calendar reads outside the selected organization", () => {
    expect(() => render(<CalendarProbe />)).toThrow(
      "useOrganizationCalendar must be used within OrganizationCalendarProvider",
    );
  });
});
