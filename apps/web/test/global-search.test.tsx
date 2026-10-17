import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { useRef, useState } from "react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { SidebarProvider } from "@/components/ui/sidebar";
import { GlobalSearch } from "@/features/search/global-search";
import { GlobalSearchTrigger } from "@/features/search/global-search-trigger";

const mocks = vi.hoisted(() => ({
  params: undefined as undefined | { q: string; limit?: number },
  options: undefined as
    | undefined
    | { query?: { enabled?: boolean; queryKey?: readonly unknown[] } },
  query: {
    data: undefined as
      | undefined
      | {
          cases: Array<Record<string, unknown>>;
          projects: Array<Record<string, unknown>>;
          tasks: Array<Record<string, unknown>>;
          clients: Array<Record<string, unknown>>;
          members: Array<Record<string, unknown>>;
        },
    isPending: false,
    isFetching: false,
    isError: false,
    refetch: vi.fn(),
  },
}));

vi.mock("@/lib/api/generated/search/search", () => ({
  useSearchGlobally: (
    params: { q: string; limit?: number },
    options: { query?: { enabled?: boolean; queryKey?: readonly unknown[] } },
  ) => {
    mocks.params = params;
    mocks.options = options;
    return mocks.query;
  },
}));

const groupedResults = {
  cases: [
    {
      id: "case-1",
      identification: "Fiscalización Andina",
      status: "in_progress",
      type: "administrative",
      client: { id: "client-1", name: "Andina S.A." },
    },
  ],
  projects: [
    {
      id: "project-1",
      name: "Expediente Andina",
      status: "active",
      client: { id: "client-1", name: "Andina S.A." },
    },
  ],
  tasks: [
    {
      id: "task-1",
      title: "Preparar recurso",
      status: "in_progress",
      project: { id: "project-1", name: "Expediente Andina" },
      client: { id: "client-1", name: "Andina S.A." },
      stage: { id: "stage-1", name: "Redacción" },
    },
  ],
  clients: [
    {
      id: "client-1",
      name: "Andina S.A.",
      type: "company",
      documentNumber: "20123456789",
    },
  ],
  members: [
    {
      userId: "user-2",
      alias: "LP",
      name: "Luis Paz",
      email: "luis@orbit.test",
      role: "member",
    },
  ],
};

function LocationProbe() {
  const location = useLocation();
  return (
    <output aria-label="Ruta actual">
      {location.pathname}
      {location.search}
    </output>
  );
}

function SearchHarness({
  helpAssistantEnabled = true,
}: {
  helpAssistantEnabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const openerRef = useRef<HTMLElement | null>(null);

  return (
    <>
      <GlobalSearchTrigger
        ref={(node) => {
          openerRef.current = node;
        }}
        onClick={() => setOpen(true)}
      />
      <GlobalSearch
        userId="user-1"
        organizationId="org-1"
        open={open}
        onOpenChange={setOpen}
        restoreFocusRef={openerRef}
        helpAssistantEnabled={helpAssistantEnabled}
      />
    </>
  );
}

function renderSearch() {
  return render(
    <MemoryRouter>
      <SidebarProvider>
        <SearchHarness />
        <LocationProbe />
      </SidebarProvider>
    </MemoryRouter>,
  );
}

describe("GlobalSearch", () => {
  beforeEach(() => {
    Element.prototype.scrollIntoView = vi.fn();
    vi.stubGlobal(
      "ResizeObserver",
      class ResizeObserver {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    );
    mocks.params = undefined;
    mocks.options = undefined;
    mocks.query.data = undefined;
    mocks.query.isPending = false;
    mocks.query.isFetching = false;
    mocks.query.isError = false;
    mocks.query.refetch.mockReset().mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  test("opens focused with safe actions and primary navigation", async () => {
    renderSearch();

    const trigger = screen.getByRole("button", { name: "Buscar" });
    expect(trigger).toHaveClass("h-11");
    fireEvent.click(trigger);

    expect(
      await screen.findByRole("dialog", { name: "Buscar en Orbit" }),
    ).toBeVisible();
    expect(screen.getByRole("button", { name: "Cerrar" })).toHaveClass(
      "size-11",
      "lg:size-8",
    );
    expect(
      screen.getByRole("combobox", { name: "Buscar en Orbit" }),
    ).toHaveFocus();
    expect(screen.getByText("Acciones rápidas")).toBeInTheDocument();
    expect(screen.getByText("Navegación")).toBeInTheDocument();
    expect(
      screen.getByRole("option", { name: /Nuevo proyecto/ }),
    ).toBeVisible();
    expect(screen.getByRole("option", { name: /Nuevo caso/ })).toBeVisible();
    expect(screen.getByRole("option", { name: /Nuevo cliente/ })).toBeVisible();
    expect(
      screen.getByRole("option", { name: /Preguntar a Orbit/ }),
    ).toBeVisible();
    expect(screen.queryByText("Nueva tarea")).not.toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Inicio" })).toBeNull();
    expect(screen.getByRole("option", { name: "Mi trabajo" })).toBeVisible();
    expect(screen.getByRole("option", { name: "Casos" })).toBeVisible();
    expect(screen.getByRole("option", { name: "Actividad" })).toBeVisible();
  });

  test("hides the assistant action when its organization flag is disabled", () => {
    render(
      <MemoryRouter>
        <SidebarProvider>
          <SearchHarness helpAssistantEnabled={false} />
        </SidebarProvider>
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Buscar" }));
    expect(
      screen.queryByRole("option", { name: /Preguntar a Orbit/ }),
    ).not.toBeInTheDocument();
  });

  test("wraps keyboard selection, shows it clearly, and opens it with Enter", async () => {
    renderSearch();
    fireEvent.click(screen.getByRole("button", { name: "Buscar" }));
    const input = screen.getByRole("combobox", { name: "Buscar en Orbit" });
    const firstOption = screen.getByRole("option", { name: "Nuevo proyecto" });
    const lastOption = screen.getByRole("option", { name: "Equipo" });

    expect(firstOption).toHaveAttribute("aria-selected", "true");
    fireEvent.keyDown(input, { key: "ArrowUp" });
    await waitFor(() =>
      expect(lastOption).toHaveAttribute("aria-selected", "true"),
    );
    expect(lastOption).toHaveClass(
      "hover:bg-muted/70",
      "data-[selected=true]:bg-primary/10",
      "data-[selected=true]:font-semibold",
      "data-[selected=true]:before:bg-primary",
    );

    fireEvent.keyDown(input, { key: "ArrowDown" });
    await waitFor(() =>
      expect(firstOption).toHaveAttribute("aria-selected", "true"),
    );
    fireEvent.keyDown(input, { key: "Enter" });
    expect(screen.getByLabelText("Ruta actual")).toHaveTextContent(
      "/projects/new",
    );
  });

  test("keeps keyboard hints fixed around a viewport-contained results list", () => {
    renderSearch();
    fireEvent.click(screen.getByRole("button", { name: "Buscar" }));

    const dialog = screen.getByRole("dialog", { name: "Buscar en Orbit" });
    const list = dialog.querySelector('[data-slot="command-list"]');
    const command = dialog.querySelector('[data-slot="command"]');
    const footer = screen.getByRole("contentinfo", {
      name: "Atajos de búsqueda",
    });

    expect(dialog).toHaveClass(
      "max-h-[calc(100dvh-2rem-env(safe-area-inset-top)-env(safe-area-inset-bottom))]",
    );
    expect(command).toHaveClass("min-h-0");
    expect(list).toHaveClass(
      "min-h-0",
      "flex-1",
      "max-h-[none]",
      "overflow-y-auto",
      "overscroll-contain",
    );
    expect(footer.parentElement).toBe(command);
    expect(
      footer.compareDocumentPosition(list!) & Node.DOCUMENT_POSITION_PRECEDING,
    ).toBeTruthy();
    expect(within(footer).getByText("↑↓").tagName).toBe("KBD");
    expect(within(footer).getByText("Enter").tagName).toBe("KBD");
    expect(within(footer).getByText("Esc").tagName).toBe("KBD");
  });

  test("debounces remote search and keeps server-ranked results visible", async () => {
    vi.useFakeTimers();
    const rendered = renderSearch();
    fireEvent.click(screen.getByRole("button", { name: "Buscar" }));
    const input = screen.getByRole("combobox", { name: "Buscar en Orbit" });

    fireEvent.change(input, { target: { value: "a" } });
    expect(mocks.options?.query?.enabled).toBe(false);
    fireEvent.change(input, { target: { value: "apelación" } });
    expect(screen.getByText("Acciones rápidas")).toBeVisible();
    act(() => vi.advanceTimersByTime(299));
    expect(mocks.params?.q).not.toBe("apelación");
    act(() => vi.advanceTimersByTime(1));
    expect(mocks.params).toEqual({ q: "apelación", limit: 5 });
    expect(mocks.options?.query?.enabled).toBe(true);
    expect(mocks.options?.query?.queryKey).toEqual([
      "/api/search",
      { q: "apelación", limit: 5 },
      { userId: "user-1", organizationId: "org-1" },
    ]);

    mocks.query.data = groupedResults;
    rendered.rerender(
      <MemoryRouter>
        <SidebarProvider>
          <SearchHarness />
          <LocationProbe />
        </SidebarProvider>
      </MemoryRouter>,
    );

    expect(screen.getByText("Casos")).toBeVisible();
    expect(screen.getByText("Proyectos")).toBeVisible();
    expect(screen.getByText("Tareas")).toBeVisible();
    expect(screen.getByText("Clientes")).toBeVisible();
    expect(screen.getByText("Miembros")).toBeVisible();
    expect(screen.getByText("Expediente Andina")).toBeVisible();
    expect(screen.getByText("Fiscalización Andina")).toBeVisible();
    expect(screen.getByText("Preparar recurso")).toBeVisible();
    expect(
      screen.getByRole("option", { name: /Preparar recurso.*Andina S\.A\./ }),
    ).toBeVisible();
    expect(screen.getByText("Andina S.A.")).toBeVisible();
    expect(screen.getByRole("option", { name: /LP.*Luis Paz/ })).toBeVisible();
  });

  test.each([
    ["Nuevo proyecto", "/projects/new"],
    ["Nuevo caso", "/cases/new"],
    ["Nuevo cliente", "/clients?action=create"],
    ["Preguntar a Orbit", "/help/ask"],
  ])("navigates from %s", async (name, expectedPath) => {
    renderSearch();
    fireEvent.click(screen.getByRole("button", { name: "Buscar" }));
    fireEvent.click(
      await screen.findByRole("option", { name: new RegExp(name) }),
    );

    expect(screen.getByLabelText("Ruta actual")).toHaveTextContent(
      expectedPath,
    );
    await waitFor(() =>
      expect(
        screen.queryByRole("dialog", { name: "Buscar en Orbit" }),
      ).not.toBeInTheDocument(),
    );
  });

  test("opens a task through its project deep link", () => {
    vi.useFakeTimers();
    mocks.query.data = groupedResults;
    renderSearch();
    fireEvent.click(screen.getByRole("button", { name: "Buscar" }));
    fireEvent.change(
      screen.getByRole("combobox", { name: "Buscar en Orbit" }),
      {
        target: { value: "recurso" },
      },
    );
    act(() => vi.advanceTimersByTime(300));

    fireEvent.click(screen.getByRole("option", { name: /Preparar recurso/ }));
    expect(screen.getByLabelText("Ruta actual")).toHaveTextContent(
      "/projects/project-1?task=task-1",
    );
  });

  test("keeps the query available when search fails and retries once", () => {
    vi.useFakeTimers();
    mocks.query.isError = true;
    renderSearch();
    fireEvent.click(screen.getByRole("button", { name: "Buscar" }));
    const input = screen.getByRole("combobox", { name: "Buscar en Orbit" });
    fireEvent.change(input, { target: { value: "apelación" } });
    act(() => vi.advanceTimersByTime(300));

    expect(screen.getByText("No pudimos realizar la búsqueda")).toBeVisible();
    expect(input).toHaveValue("apelación");
    fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    expect(mocks.query.refetch).toHaveBeenCalledOnce();
    expect(
      screen.getByRole("dialog", { name: "Buscar en Orbit" }),
    ).toBeVisible();
  });

  test("only handles an exact platform search shortcut", async () => {
    renderSearch();

    fireEvent.keyDown(window, { key: "k", ctrlKey: true, altKey: true });
    fireEvent.keyDown(window, { key: "k", metaKey: true, shiftKey: true });
    fireEvent.keyDown(window, { key: "k", metaKey: true, ctrlKey: true });
    expect(
      screen.queryByRole("dialog", { name: "Buscar en Orbit" }),
    ).not.toBeInTheDocument();

    fireEvent.keyDown(window, { key: "k", metaKey: true });
    expect(
      await screen.findByRole("dialog", { name: "Buscar en Orbit" }),
    ).toBeVisible();
  });
});
