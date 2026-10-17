import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { ProjectTaskCalendar } from "@/features/projects/project-task-calendar";
import type { ProjectTaskCalendarFilterState } from "@/features/projects/project-task-calendar-filters";

const mocks = vi.hoisted(() => ({
  query: {
    data: undefined as unknown,
    isPending: false,
    isError: false,
    isFetching: false,
    isPlaceholderData: false,
    refetch: vi.fn(),
  },
  params: undefined as unknown,
}));
vi.mock("@/lib/api/generated/project-tasks/project-tasks", () => ({
  useListProjectTaskCalendar: (params: unknown) => {
    mocks.params = params;
    return mocks.query;
  },
  useListUndatedProjectTasks: () => ({
    data: {
      tasks: [],
      pagination: { page: 1, pageSize: 25, total: 0, totalPages: 0 },
    },
    isPending: false,
    isError: false,
    isPlaceholderData: false,
    refetch: vi.fn(),
  }),
}));
vi.mock("@/features/projects/project-task-calendar-filters", () => ({
  ProjectTaskCalendarFilters: () => <div>Filtros de tareas</div>,
}));

const filters: ProjectTaskCalendarFilterState = {
  search: "demanda",
  projectIds: ["p1", "p2"],
  responsibleUserIds: ["u1"],
  statuses: ["blocked"],
  overdueOnly: true,
};

function renderCalendar(onMonthChange = vi.fn()) {
  render(
    <MemoryRouter>
      <ProjectTaskCalendar
        month="2026-08"
        today="2026-08-11"
        filters={filters}
        onFiltersChange={vi.fn()}
        onMonthChange={onMonthChange}
        onOpenTask={vi.fn()}
        onOpenProject={vi.fn()}
      />
    </MemoryRouter>,
  );
  return onMonthChange;
}

describe("ProjectTaskCalendar", () => {
  beforeEach(() => {
    mocks.query.data = {
      tasks: [],
      markers: [],
      undatedTaskCount: 3,
      truncated: false,
    };
    mocks.query.isPending = false;
    mocks.query.isError = false;
    mocks.query.isFetching = false;
    mocks.query.isPlaceholderData = false;
    mocks.query.refetch.mockReset();
  });

  test("passes the visible range and every active filter to the generated hook", () => {
    renderCalendar();
    expect(mocks.params).toEqual({
      from: "2026-07-27",
      to: "2026-09-06",
      projectIds: ["p1", "p2"],
      responsibleUserIds: ["u1"],
      statuses: ["blocked"],
      search: "demanda",
      overdueOnly: "true",
    });
    expect(
      screen.getByRole("button", { name: /Tareas sin fechas.*3/i }),
    ).toBeVisible();
  });

  test("navigates months and returns to today", () => {
    const onMonthChange = renderCalendar();
    fireEvent.click(screen.getByRole("button", { name: "Mes anterior" }));
    fireEvent.click(screen.getByRole("button", { name: "Ir al mes actual" }));
    fireEvent.click(screen.getByRole("button", { name: "Mes siguiente" }));
    expect(onMonthChange.mock.calls.map(([month]) => month)).toEqual([
      "2026-07",
      "2026-08",
      "2026-09",
    ]);
  });

  test("shows retryable initial errors and truncation warnings", () => {
    mocks.query.data = undefined;
    mocks.query.isError = true;
    const first = renderCalendar();
    expect(
      screen.getByText("No pudimos cargar el calendario de tareas."),
    ).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Intentar de nuevo" }));
    expect(mocks.query.refetch).toHaveBeenCalledOnce();
    first.mockClear();
  });
});
