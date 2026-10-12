import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";

import type { CaseEventCalendarItem } from "@/lib/api/generated/models";
import { CaseEventCalendarAgenda } from "./case-event-calendar-agenda";
import { layoutCaseEventCalendar } from "./case-event-calendar-layout";

const event: CaseEventCalendarItem = {
  id: "event-1",
  title: "Informe oral",
  type: "oral_argument",
  date: "2026-09-19",
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
};

describe("CaseEventCalendarAgenda", () => {
  test("shows only dates with events and opens an event", () => {
    const onOpenEvent = vi.fn();
    render(
      <CaseEventCalendarAgenda
        layout={layoutCaseEventCalendar([event], "2026-09", "2026-09-17")}
        onOpenEvent={onOpenEvent}
      />,
    );

    expect(
      screen.getByRole("region", { name: "Agenda de eventos de casos" }),
    ).toBeVisible();
    expect(screen.getByText(/sábado, 19 de septiembre de 2026/i)).toBeVisible();
    expect(screen.getByText("Cliente · Proceso tributario")).toBeVisible();
    fireEvent.click(
      screen.getByRole("button", {
        name: /Informe oral.*Cliente.*Proceso tributario/i,
      }),
    );
    expect(onOpenEvent).toHaveBeenCalledWith(event, expect.any(HTMLElement));
  });
});
