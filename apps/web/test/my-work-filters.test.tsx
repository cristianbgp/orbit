import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { MyWorkFilters } from "@/features/my-work/my-work-filters";

vi.mock("@/lib/api/generated/projects/projects", () => ({
  useListProjects: () => ({
    data: {
      projects: [
        {
          id: "project-1",
          name: "Apelación",
          client: { id: "client-1", name: "Constructora" },
        },
      ],
      pagination: { page: 1, pageSize: 100, total: 1, totalPages: 1 },
    },
  }),
}));

Element.prototype.scrollIntoView = vi.fn();
vi.stubGlobal(
  "ResizeObserver",
  class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
);

const empty = {
  search: "",
  projectIds: [],
  statuses: [],
  dateFrom: "",
  dateTo: "",
  includeCompleted: false,
} as const;

describe("MyWorkFilters", () => {
  beforeEach(() => {
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: 1024,
    });
  });

  afterEach(() => vi.useRealTimers());

  test("debounces text search before updating route filters", () => {
    vi.useFakeTimers();
    const onChange = vi.fn();
    render(
      <MyWorkFilters
        value={{ ...empty, projectIds: [], statuses: [] }}
        onChange={onChange}
      />,
    );
    const search = screen.getByRole("searchbox", {
      name: "Buscar en Mi trabajo",
    });
    expect(screen.getByLabelText("Filtros de Mi trabajo")).toHaveClass(
      "w-full",
      "flex-1",
    );
    expect(search.closest("label")).toHaveClass("md:max-w-xl");
    expect(search.closest("label")).not.toHaveClass("md:max-w-md");
    expect(search).toHaveAttribute(
      "placeholder",
      "Buscar tarea, proyecto, cliente o referencia",
    );
    fireEvent.change(search, { target: { value: "demanda" } });
    expect(onChange).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(299));
    expect(onChange).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1));
    expect(onChange).toHaveBeenCalledWith({
      ...empty,
      projectIds: [],
      statuses: [],
      search: "demanda",
    });
  });

  test("keeps the active result count grouped with the filter action", () => {
    render(
      <MyWorkFilters
        value={{ ...empty, projectIds: [], statuses: [] }}
        resultSummary="3 tareas"
        onChange={vi.fn()}
      />,
    );

    const actions = screen
      .getByRole("button", { name: "Filtrar Mi trabajo" })
      .closest('[data-slot="my-work-filter-actions"]');

    expect(actions).not.toBeNull();
    expect(actions).toHaveClass("shrink-0", "items-center");
    expect(actions).toContainElement(screen.getByText("3 tareas"));
  });

  test("uses one compact property filter and selects a task status", () => {
    const onChange = vi.fn();
    render(
      <MyWorkFilters
        value={{ ...empty, projectIds: [], statuses: [] }}
        onChange={onChange}
      />,
    );

    expect(
      screen.queryByRole("button", { name: "Proyectos" }),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Filtrar Mi trabajo" }));
    expect(screen.getByRole("option", { name: "Proyecto" })).toBeVisible();
    expect(
      screen.getByRole("option", { name: "Estado de tarea" }),
    ).toBeVisible();
    expect(screen.getByRole("option", { name: "Fecha límite" })).toBeVisible();
    expect(
      screen.getByRole("option", { name: "Tareas completadas" }),
    ).toBeVisible();

    fireEvent.click(screen.getByRole("option", { name: "Estado de tarea" }));
    fireEvent.click(screen.getByRole("option", { name: "Suspendida" }));
    expect(onChange).toHaveBeenCalledWith({
      ...empty,
      projectIds: [],
      statuses: ["blocked"],
    });
  });

  test("shows active property chips and clears them independently", () => {
    const onChange = vi.fn();
    render(
      <MyWorkFilters
        value={{
          ...empty,
          projectIds: ["project-1"],
          statuses: ["blocked"],
          includeCompleted: true,
        }}
        onChange={onChange}
      />,
    );

    expect(
      screen.getByRole("button", { name: "Filtrar Mi trabajo, 3 activos" }),
    ).toHaveTextContent("3");
    expect(screen.getByText("Proyecto: Apelación")).toBeVisible();
    expect(screen.getByText("Estado de tarea: Suspendida")).toBeVisible();
    expect(screen.getByText("Tareas completadas: Incluir")).toBeVisible();

    fireEvent.click(
      screen.getByRole("button", { name: "Quitar filtro Estado de tarea" }),
    );
    expect(onChange).toHaveBeenCalledWith({
      ...empty,
      projectIds: ["project-1"],
      statuses: [],
      includeCompleted: true,
    });
  });

  test("uses a viewport-bounded bottom drawer below the desktop breakpoint", async () => {
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: 820,
    });
    render(
      <MyWorkFilters
        value={{ ...empty, projectIds: [], statuses: [] }}
        onChange={vi.fn()}
      />,
    );

    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Filtrar Mi trabajo" }),
      ).toBeVisible(),
    );
    fireEvent.click(screen.getByRole("button", { name: "Filtrar Mi trabajo" }));
    const drawer = screen.getByRole("dialog", {
      name: "Filtrar Mi trabajo",
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(drawer).toHaveAttribute("data-slot", "drawer-content");
    expect(screen.getByPlaceholderText("Buscar propiedad")).not.toHaveFocus();
    expect(drawer).toHaveClass(
      "data-[vaul-drawer-direction=bottom]:max-h-[85dvh]",
      "pb-[max(1rem,env(safe-area-inset-bottom))]",
      "overflow-hidden",
    );
    expect(
      drawer.querySelector('[data-slot="drawer-handle"]'),
    ).toBeInTheDocument();
    expect(drawer.querySelector('[data-slot="command-list"]')).toHaveClass(
      "overflow-y-auto",
      "overscroll-contain",
    );
  });

  test("keeps the desktop popover at the 1024px boundary", () => {
    render(
      <MyWorkFilters
        value={{ ...empty, projectIds: [], statuses: [] }}
        onChange={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Filtrar Mi trabajo" }));
    expect(
      document.querySelector('[data-slot="popover-content"]'),
    ).toBeVisible();
    expect(document.querySelector('[data-slot="drawer-content"]')).toBeNull();
  });
});
