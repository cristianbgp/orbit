import { fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { CaseEventCalendar } from "./case-event-calendar";

const mocks = vi.hoisted(() => ({
  params: undefined as unknown,
  query: {
    data: { events: [], truncated: false } as unknown,
    isPending: false,
    isError: false,
    isFetching: false,
    isPlaceholderData: false,
    refetch: vi.fn(),
  },
}));

vi.mock("@/lib/api/generated/case-events/case-events", () => ({
  useListCaseEventCalendar: (params: unknown) => {
    mocks.params = params;
    return mocks.query;
  },
  useUpdateCaseEvent: () => ({ isPending: false, mutateAsync: vi.fn() }),
  useDeleteCaseEvent: () => ({ isPending: false, mutateAsync: vi.fn() }),
  getListCaseEventCalendarQueryKey: () => ["/api/case-events/calendar"],
  getListCaseEventsQueryKey: (caseId: string) => [
    `/api/cases/${caseId}/events`,
  ],
}));

function calendarElement(month = "2026-09", onMonthChange = vi.fn()) {
  return (
    <QueryClientProvider
      client={
        new QueryClient({
          defaultOptions: { queries: { retry: false } },
        })
      }
    >
      <MemoryRouter>
        <CaseEventCalendar
          month={month}
          today="2026-09-17"
          caseStatus="in_progress"
          search="informe"
          filters={{
            types: ["judicial"],
            clientIds: ["client-1"],
            memberUserIds: ["user-2"],
          }}
          onMonthChange={onMonthChange}
        />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

function renderCalendar(onMonthChange = vi.fn()) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <CaseEventCalendar
          month="2026-09"
          today="2026-09-17"
          caseStatus="in_progress"
          search="informe"
          filters={{
            types: ["judicial"],
            clientIds: ["client-1"],
            memberUserIds: ["user-2"],
          }}
          onMonthChange={onMonthChange}
        />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return onMonthChange;
}

describe("CaseEventCalendar", () => {
  beforeEach(() => {
    mocks.query.data = { events: [], truncated: false };
    mocks.query.isPending = false;
    mocks.query.isError = false;
    mocks.query.isFetching = false;
    mocks.query.isPlaceholderData = false;
    mocks.query.refetch.mockReset();
  });

  test("queries the visible range with the shared case filters", () => {
    renderCalendar();
    expect(mocks.params).toEqual({
      from: "2026-08-31",
      to: "2026-10-04",
      caseStatus: "in_progress",
      search: "informe",
      type: ["judicial"],
      client: ["client-1"],
      member: ["user-2"],
    });
    expect(screen.getByText("No hay eventos con estos filtros.")).toBeVisible();
  });

  test("navigates adjacent months and returns to today", () => {
    const onMonthChange = renderCalendar();
    fireEvent.click(screen.getByRole("button", { name: "Mes anterior" }));
    fireEvent.click(screen.getByRole("button", { name: "Ir al mes actual" }));
    fireEvent.click(screen.getByRole("button", { name: "Mes siguiente" }));
    expect(onMonthChange.mock.calls.map(([month]) => month)).toEqual([
      "2026-08",
      "2026-09",
      "2026-10",
    ]);
  });

  test("offers retry after an initial failure", () => {
    mocks.query.data = undefined;
    mocks.query.isError = true;
    renderCalendar();
    expect(
      screen.getByText("No pudimos cargar el calendario de eventos."),
    ).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Intentar de nuevo" }));
    expect(mocks.query.refetch).toHaveBeenCalledOnce();
  });

  test("keeps the settled month visible when the next request fails", () => {
    const view = render(calendarElement());
    expect(screen.getByText("septiembre de 2026")).toBeVisible();

    mocks.query.data = undefined;
    mocks.query.isError = true;
    view.rerender(calendarElement("2026-10"));

    expect(screen.getByText("septiembre de 2026")).toBeVisible();
    expect(
      screen.getByText("No pudimos actualizar el calendario de eventos."),
    ).toBeVisible();
  });
});
