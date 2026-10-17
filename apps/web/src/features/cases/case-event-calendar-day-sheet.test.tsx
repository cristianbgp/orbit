import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";

import type { CaseEventCalendarItem } from "@/lib/api/generated/models";
import { CaseEventCalendarDaySheet } from "./case-event-calendar-day-sheet";

const event = {
  id: "event-1",
  title: "Vista de la causa",
  type: "oral_argument",
  date: "2026-09-17",
  description: null,
  createdByUserId: null,
  createdAt: "2026-09-01T10:00:00.000Z",
  updatedAt: "2026-09-01T10:00:00.000Z",
  case: {
    id: "case-1",
    identification: "Proceso tributario",
    status: "in_progress",
    type: "judicial",
    stage: null,
    docketNumber: null,
    client: { id: "client-1", name: "Cliente" },
  },
} satisfies CaseEventCalendarItem;

describe("CaseEventCalendarDaySheet", () => {
  test("shows complete day context and opens an event", () => {
    const onOpenEvent = vi.fn();
    render(
      <CaseEventCalendarDaySheet
        open
        date="2026-09-17"
        events={[event]}
        onOpenChange={vi.fn()}
        onOpenEvent={onOpenEvent}
      />,
    );

    expect(
      screen.getByRole("heading", { name: /17 de septiembre de 2026/i }),
    ).toBeVisible();
    expect(screen.getByText("Cliente · Proceso tributario")).toBeVisible();
    fireEvent.click(
      screen.getByRole("button", {
        name: /Vista de la causa.*Cliente.*Proceso tributario/i,
      }),
    );
    expect(onOpenEvent).toHaveBeenCalledWith(event, expect.any(HTMLElement));
  });
});
