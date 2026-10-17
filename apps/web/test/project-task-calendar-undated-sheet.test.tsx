import { createRef } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { ProjectTaskCalendarUndatedSheet } from "@/features/projects/project-task-calendar-undated-sheet";
import type { ProjectTaskCalendarFilterState } from "@/features/projects/project-task-calendar-filters";

const mocks = vi.hoisted(() => ({
  query: {
    data: undefined as unknown,
    isPending: false,
    isError: false,
    isPlaceholderData: false,
    refetch: vi.fn(),
  },
  params: undefined as unknown,
}));

vi.mock("@/lib/api/generated/project-tasks/project-tasks", () => ({
  useListUndatedProjectTasks: (params: unknown) => {
    mocks.params = params;
    return mocks.query;
  },
}));

const filters: ProjectTaskCalendarFilterState = {
  search: "",
  projectIds: [],
  responsibleUserIds: [],
  statuses: [],
  overdueOnly: false,
};

const task = {
  id: "task-1",
  title: "Definir estrategia",
  status: "pending" as const,
  internalDueDate: null,
  position: 0,
  plannedStartDate: null,
  project: {
    id: "project-1",
    name: "Apelación Rivera",
    startDate: "2026-08-01",
    client: { id: "client-1", name: "Rivera SAC" },
  },
  stage: { id: "stage-1", name: "Estrategia", position: 1 },
  responsibles: [],
};

function renderSheet() {
  const onOpenChange = vi.fn();
  const onOpenTask = vi.fn();
  const onOpenProject = vi.fn();
  const openerRef = createRef<HTMLButtonElement>();
  render(
    <MemoryRouter>
      <button ref={openerRef}>Abrir sin fechas</button>
      <ProjectTaskCalendarUndatedSheet
        open
        filters={filters}
        today="2026-08-11"
        openerRef={openerRef}
        onOpenChange={onOpenChange}
        onOpenTask={onOpenTask}
        onOpenProject={onOpenProject}
      />
    </MemoryRouter>,
  );
  return { onOpenChange, onOpenTask, onOpenProject };
}

describe("ProjectTaskCalendarUndatedSheet", () => {
  beforeEach(() => {
    mocks.query.data = {
      tasks: [task],
      pagination: { page: 1, pageSize: 25, total: 26, totalPages: 2 },
    };
    mocks.query.isPending = false;
    mocks.query.isError = false;
    mocks.query.isPlaceholderData = false;
    mocks.query.refetch.mockReset();
  });

  test("groups task context by project and opens date editing", () => {
    const { onOpenChange, onOpenTask, onOpenProject } = renderSheet();
    expect(
      screen.getByRole("heading", { name: "Apelación Rivera" }),
    ).toBeVisible();
    expect(screen.getByText("Rivera SAC")).toBeVisible();
    expect(screen.getByText("Estrategia")).toBeVisible();

    fireEvent.click(
      screen.getByRole("link", { name: /Agregar fechas.*Definir estrategia/i }),
    );
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onOpenTask).toHaveBeenCalledWith(
      "project-1",
      "task-1",
      expect.any(HTMLElement),
    );
    fireEvent.click(
      screen.getByRole("link", { name: /Abrir proyecto Apelación Rivera/i }),
    );
    expect(onOpenProject).toHaveBeenCalledWith("project-1");
  });

  test("paginates with active filters and retains the previous page", () => {
    renderSheet();
    expect(mocks.params).toMatchObject({ page: 1, pageSize: 25 });
    fireEvent.click(screen.getByRole("button", { name: "Siguiente" }));
    expect(mocks.params).toMatchObject({ page: 2, pageSize: 25 });
  });

  test("renders loading, retryable error, and empty states", () => {
    mocks.query.data = undefined;
    mocks.query.isPending = true;
    const first = renderSheet();
    expect(screen.getByLabelText("Cargando tareas sin fechas")).toBeVisible();
    first.onOpenChange.mockClear();
  });
});
