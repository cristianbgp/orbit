import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";

import {
  ProjectTaskCalendarFilters,
  type ProjectTaskCalendarFilterState,
} from "@/features/projects/project-task-calendar-filters";

const mocks = vi.hoisted(() => ({ onChange: vi.fn() }));

vi.stubGlobal(
  "ResizeObserver",
  class {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
);
Element.prototype.scrollIntoView = vi.fn();

vi.mock("@/lib/api/generated/projects/projects", () => ({
  useListProjects: () => ({
    data: {
      projects: [
        {
          id: "project-1",
          name: "Apelación Rivera",
          client: { name: "Rivera SAC" },
        },
        {
          id: "project-2",
          name: "Consulta tributaria",
          client: { name: "Andes SAC" },
        },
      ],
      pagination: { total: 2 },
    },
    isPending: false,
    isError: false,
  }),
}));

vi.mock("@/lib/api/generated/team/team", () => ({
  useListTeamMembers: () => ({
    data: {
      members: [
        { userId: "user-1", alias: "CG", name: "Cristian Granda" },
        { userId: "user-2", alias: "AM", name: "Ana Mendoza" },
      ],
      pagination: { total: 2 },
    },
    isPending: false,
    isError: false,
  }),
}));

const empty: ProjectTaskCalendarFilterState = {
  search: "",
  projectIds: [],
  responsibleUserIds: [],
  statuses: [],
  overdueOnly: false,
};

describe("ProjectTaskCalendarFilters", () => {
  test("debounces calendar search", () => {
    vi.useFakeTimers();
    render(
      <ProjectTaskCalendarFilters value={empty} onChange={mocks.onChange} />,
    );

    fireEvent.change(screen.getByLabelText("Buscar tareas"), {
      target: { value: "demanda" },
    });
    expect(mocks.onChange).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(300));
    expect(mocks.onChange).toHaveBeenCalledWith({
      ...empty,
      search: "demanda",
    });
    vi.useRealTimers();
  });

  test("selects multiple projects, members, statuses, and overdue work", () => {
    let value = empty;
    const onChange = vi.fn((next: ProjectTaskCalendarFilterState) => {
      value = next;
      view.rerender(
        <ProjectTaskCalendarFilters value={value} onChange={onChange} />,
      );
    });
    const view = render(
      <ProjectTaskCalendarFilters value={value} onChange={onChange} />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Proyectos/i }));
    fireEvent.click(
      screen.getByRole("checkbox", { name: /Apelación Rivera/i }),
    );
    fireEvent.click(
      screen.getByRole("checkbox", { name: /Consulta tributaria/i }),
    );
    fireEvent.click(screen.getByRole("button", { name: /Encargados/i }));
    fireEvent.click(
      screen.getByRole("checkbox", { name: /CG.*Cristian Granda/i }),
    );
    fireEvent.click(screen.getByRole("button", { name: /Estados/i }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Suspendida" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Solo vencidas" }));

    expect(value).toMatchObject({
      projectIds: ["project-1", "project-2"],
      responsibleUserIds: ["user-1"],
      statuses: ["blocked"],
      overdueOnly: true,
    });
  });

  test("renders removable chips and clears every task filter", () => {
    const value: ProjectTaskCalendarFilterState = {
      search: "demanda",
      projectIds: ["project-1"],
      responsibleUserIds: ["user-1"],
      statuses: ["blocked"],
      overdueOnly: true,
    };
    render(
      <ProjectTaskCalendarFilters value={value} onChange={mocks.onChange} />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Quitar proyecto Apelación Rivera" }),
    );
    expect(mocks.onChange).toHaveBeenCalledWith({ ...value, projectIds: [] });
    fireEvent.click(
      screen.getByRole("button", { name: "Limpiar filtros del calendario" }),
    );
    expect(mocks.onChange).toHaveBeenCalledWith(empty);
  });
});
