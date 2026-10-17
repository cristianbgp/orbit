import { fireEvent, render, screen, within } from "@testing-library/react";
import { expect, test, vi } from "vitest";

import type { CaseEventCalendarItem } from "@/lib/api/generated/models";
import { layoutCaseEventCalendar } from "./case-event-calendar-layout";
import { CaseEventCalendarGrid } from "./case-event-calendar-grid";

function event(id: string, title: string): CaseEventCalendarItem {
  return {
    id,
    title,
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
      stage: "judicial_first_instance",
      docketNumber: null,
      client: { id: "client-1", name: "Cliente" },
    },
  };
}

test("renders bounded event entries and opens daily overflow", () => {
  const onOpenEvent = vi.fn();
  const onOpenDay = vi.fn();
  const events = ["A", "B", "C", "D", "E"].map((title, index) =>
    event(`event-${index}`, title),
  );
  render(
    <CaseEventCalendarGrid
      layout={layoutCaseEventCalendar(events, "2026-09", "2026-09-17")}
      onOpenEvent={onOpenEvent}
      onOpenDay={onOpenDay}
    />,
  );

  expect(
    screen.getByRole("grid", { name: "Calendario de eventos de casos" }),
  ).toBeVisible();
  expect(screen.getAllByRole("columnheader")).toHaveLength(7);
  expect(
    screen.getByRole("gridcell", { name: /jueves, 17 de septiembre/i }),
  ).toHaveAttribute("aria-current", "date");
  const eventButton = screen.getByRole("button", {
    name: /A.*Cliente.*Proceso tributario/i,
  });
  expect(
    within(eventButton).getByText("Cliente · Proceso tributario"),
  ).toBeVisible();
  fireEvent.click(eventButton);
  expect(onOpenEvent).toHaveBeenCalledWith(events[0], expect.any(HTMLElement));
  fireEvent.click(screen.getByRole("button", { name: /1 evento adicional/i }));
  expect(onOpenDay).toHaveBeenCalledWith("2026-09-17", expect.any(HTMLElement));
});
