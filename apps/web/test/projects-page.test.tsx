import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { MemoryRouter, useLocation, useNavigate } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { ProjectsPage } from "@/features/projects/projects-page";
import { OrganizationCalendarProvider } from "@/features/organization/organization-calendar-context";

Element.prototype.scrollIntoView = vi.fn();
vi.stubGlobal(
  "ResizeObserver",
  class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
);

function chooseDisplayOption(group: string, option: string) {
  fireEvent.click(screen.getByRole("button", { name: "Opciones de vista" }));
  fireEvent.click(
    within(screen.getByRole("group", { name: group })).getByRole("radio", {
      name: option,
    }),
  );
  fireEvent.keyDown(document, { key: "Escape" });
}

function chooseProjectFilter(property: string, option: string) {
  fireEvent.click(screen.getByRole("button", { name: /Filtrar proyectos/ }));
  fireEvent.click(screen.getByRole("option", { name: property }));
  fireEvent.click(screen.getByRole("option", { name: option }));
  fireEvent.keyDown(document, { key: "Escape" });
}

const mocks = vi.hoisted(() => ({
  query: {
    data: undefined as
      | undefined
      | {
          projects: Array<Record<string, unknown>>;
          pagination: {
            page: number;
            pageSize: number;
            total: number;
            totalPages: number;
          };
        },
    isPending: false,
    isError: false,
    isPlaceholderData: false,
    refetch: vi.fn(),
  },
  create: vi.fn(),
  lastParams: undefined as unknown,
  listCalls: [] as Array<{
    params: Record<string, unknown>;
    enabled: boolean | undefined;
  }>,
  lastListEnabled: undefined as boolean | undefined,
  lastGroupedParams: undefined as unknown,
  lastGroupedEnabled: undefined as boolean | undefined,
  groupedData: undefined as
    | undefined
    | {
        groups: Array<{
          client: { id: string; name: string };
          projects: Array<Record<string, unknown>>;
        }>;
        pagination: {
          page: number;
          pageSize: number;
          total: number;
          totalPages: number;
        };
        projectTotal: number;
      },
  calendarProps: undefined as undefined | Record<string, unknown>,
  calendarFilterProps: undefined as undefined | Record<string, unknown>,
  portfolioProps: undefined as undefined | Record<string, unknown>,
}));

vi.mock("@/lib/api/generated/projects/projects", () => ({
  getListProjectsQueryKey: () => ["/api/projects"],
  getListProjectsGroupedByClientQueryKey: () => [
    "/api/projects/grouped-by-client",
  ],
  useListProjects: (
    params: Record<string, unknown>,
    options?: { query?: { enabled?: boolean } },
  ) => {
    mocks.lastParams = params;
    mocks.lastListEnabled = options?.query?.enabled;
    mocks.listCalls.push({ params, enabled: options?.query?.enabled });
    return mocks.query;
  },
  useListProjectsGroupedByClient: (
    params: unknown,
    options?: { query?: { enabled?: boolean } },
  ) => {
    mocks.lastGroupedParams = params;
    mocks.lastGroupedEnabled = options?.query?.enabled;
    const groupedData =
      mocks.groupedData ??
      (mocks.query.data
        ? {
            groups: mocks.query.data.projects.length
              ? [
                  {
                    client: mocks.query.data.projects[0]?.client as {
                      id: string;
                      name: string;
                    },
                    projects: mocks.query.data.projects,
                  },
                ]
              : [],
            pagination: {
              ...mocks.query.data.pagination,
              pageSize: 10,
            },
            projectTotal: mocks.query.data.pagination.total,
          }
        : undefined);
    return { ...mocks.query, data: groupedData };
  },
  useCreateProject: () => ({ mutateAsync: mocks.create, isPending: false }),
}));

vi.mock("@/lib/api/generated/clients/clients", () => ({
  useListClients: () => ({
    data: {
      clients: [
        {
          id: "client-1",
          name: "Constructora del Sur S.A.",
          type: "company",
        },
      ],
      pagination: { page: 1, pageSize: 100, total: 1, totalPages: 1 },
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
        { userId: "user-2", alias: "MP", name: "María Pérez" },
      ],
      pagination: { page: 1, pageSize: 100, total: 2, totalPages: 1 },
    },
    isPending: false,
    isError: false,
  }),
}));

vi.mock("@/features/projects/project-task-calendar", () => ({
  ProjectTaskCalendar: (props: Record<string, unknown>) => {
    mocks.calendarProps = props;
    return (
      <div>
        Calendario {String(props.month)}
        <button
          type="button"
          onClick={() =>
            (props.onOpenProject as (projectId: string) => void)("project-1")
          }
        >
          Abrir proyecto del calendario
        </button>
        <button
          type="button"
          onClick={() =>
            (props.onFiltersChange as (value: unknown) => void)({
              search: "demanda",
              projectIds: ["project-2", "project-1", "project-1"],
              responsibleUserIds: ["user-2"],
              statuses: ["blocked"],
              overdueOnly: true,
            })
          }
        >
          Aplicar filtros del calendario
        </button>
        <button
          type="button"
          onClick={(event) =>
            (
              props.onOpenTask as (
                projectId: string,
                taskId: string,
                opener: HTMLElement,
              ) => void
            )("project-1", "task-1", event.currentTarget)
          }
        >
          Abrir tarea del calendario
        </button>
      </div>
    );
  },
}));

vi.mock("@/features/projects/portfolio-task-sheet", () => ({
  PortfolioTaskSheet: (props: Record<string, unknown>) => {
    mocks.portfolioProps = props;
    return null;
  },
}));

vi.mock("@/features/projects/project-form", () => ({
  ProjectForm: ({
    initialProject,
    onSubmit,
    onCancel,
  }: {
    initialProject?: { id: string };
    onSubmit(input: Record<string, unknown>): Promise<void> | void;
    onCancel(): void;
  }) => (
    <div>
      <p>
        {initialProject
          ? `Formulario ${initialProject.id}`
          : "Formulario nuevo"}
      </p>
      <button
        type="button"
        onClick={() =>
          void onSubmit({
            name: "Recurso de apelación",
            clientId: "client-1",
            type: "written_submission",
            status: "draft",
            startDate: "2026-08-06",
            endDate: "2026-08-14",
          })
        }
      >
        Guardar proyecto
      </button>
      <button type="button" onClick={onCancel}>
        Cancelar
      </button>
    </div>
  ),
}));

const project = {
  id: "project-1",
  client: { id: "client-1", name: "Constructora del Sur S.A." },
  name: "Apelación Constructora",
  type: "written_submission",
  status: "draft",
  startDate: "2026-08-06",
  endDate: "2026-08-14",
  internalReference: "EXP-2026-014",
  description: null,
  archivedAt: null,
  createdAt: "2026-08-05T10:00:00.000Z",
  updatedAt: "2026-08-05T10:00:00.000Z",
  team: {
    members: [
      {
        userId: "user-1",
        fullName: "Cristian Granda",
        alias: "CG",
        avatarColor: "#4657d9",
        responsibility: "responsible",
      },
    ],
    total: 1,
  },
};

function renderPage(
  initialEntry = "/projects",
  today: string | null = "2026-08-10",
) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const invalidate = vi.spyOn(queryClient, "invalidateQueries");

  const rendered = render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <OrganizationCalendarProvider timeZone="America/Lima">
          {today === null ? (
            <ProjectsPage currentUserId="user-1" />
          ) : (
            <ProjectsPage currentUserId="user-1" today={today} />
          )}
        </OrganizationCalendarProvider>
        <LocationProbe />
      </MemoryRouter>
    </QueryClientProvider>,
  );

  return { invalidate, unmount: rendered.unmount };
}

function LocationProbe() {
  const location = useLocation();
  const navigate = useNavigate();
  return (
    <>
      <output aria-label="Ruta actual">
        {location.pathname}
        {location.search}
      </output>
      <button type="button" onClick={() => navigate(-1)}>
        Volver en historial
      </button>
      <button type="button" onClick={() => navigate(1)}>
        Avanzar en historial
      </button>
    </>
  );
}

describe("ProjectsPage", () => {
  beforeEach(() => {
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: 1024,
    });
    mocks.query.data = {
      projects: [],
      pagination: { page: 1, pageSize: 25, total: 0, totalPages: 0 },
    };
    mocks.query.isPending = false;
    mocks.query.isError = false;
    mocks.query.isPlaceholderData = false;
    mocks.query.refetch.mockReset().mockResolvedValue(undefined);
    mocks.create.mockReset().mockResolvedValue({ project });
    mocks.lastParams = undefined;
    mocks.listCalls = [];
    mocks.lastListEnabled = undefined;
    mocks.lastGroupedParams = undefined;
    mocks.lastGroupedEnabled = undefined;
    mocks.groupedData = undefined;
    mocks.calendarProps = undefined;
    mocks.calendarFilterProps = undefined;
    mocks.portfolioProps = undefined;
  });

  afterEach(() => {
    vi.useRealTimers();
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: 1024,
    });
  });

  test("uses the shared application page frame", () => {
    renderPage();

    const heading = screen.getByRole("heading", { name: "Proyectos" });
    expect(heading.closest('[data-slot="app-page"]')).toHaveClass(
      "max-w-384",
      "py-6",
      "lg:py-8",
    );
    expect(
      heading
        .closest('[data-slot="app-page-header"]')
        ?.querySelector("svg.lucide-folder-kanban"),
    ).toHaveAttribute("aria-hidden", "true");
    expect(
      heading.closest('[data-slot="app-page-header"]')?.nextElementSibling,
    ).toHaveAttribute("data-slot", "app-page-content");
  });

  test("renders list-shaped loading feedback", () => {
    mocks.query.isPending = true;
    mocks.query.data = undefined;
    renderPage();

    expect(screen.getByLabelText("Cargando proyectos")).toBeInTheDocument();
  });

  test("renders a recoverable list error", () => {
    mocks.query.isError = true;
    mocks.query.data = undefined;
    renderPage();

    expect(
      screen.getByText("No pudimos cargar tus proyectos"),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Intentar de nuevo" }));
    expect(mocks.query.refetch).toHaveBeenCalledOnce();
  });

  test("guides an empty Estudio into project creation", () => {
    renderPage();

    expect(screen.getByText("Tu cartera empieza aquí")).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: "Crear primer proyecto" }),
    );
    expect(screen.getByLabelText("Ruta actual")).toHaveTextContent(
      "/projects/new",
    );
  });

  test("exposes ongoing, completed, and archived lifecycle tabs", () => {
    renderPage();

    expect(screen.getByRole("tab", { name: "En curso" })).toBeInTheDocument();
    expect(
      screen.getByRole("tab", { name: "Completados" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("tab", { name: "Cancelados" }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Archivados" })).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Proyectos en curso" }),
    ).toBeInTheDocument();
    expect(mocks.lastGroupedParams).toEqual({
      view: "current",
      orderBy: "endDate",
      order: "asc",
      page: 1,
      pageSize: 10,
    });

    fireEvent.click(screen.getByRole("button", { name: "Filtrar proyectos" }));
    fireEvent.click(screen.getByRole("option", { name: "Estado" }));
    expect(screen.getByRole("option", { name: "Activo" })).toBeInTheDocument();
    expect(
      screen.queryByRole("option", { name: "Completado" }),
    ).not.toBeInTheDocument();
  });

  test("hydrates compact multi-value filters from the URL", () => {
    renderPage(
      "/projects?groupBy=none&q=apelacion&type=consultation&type=written_submission&status=active&client=client-1&member=user-1&member=user-2",
    );

    expect(
      screen.getByRole("button", { name: /Filtrar proyectos/ }),
    ).toHaveTextContent("4");
    expect(
      screen.getByRole("button", { name: "Opciones de vista" }),
    ).toBeInTheDocument();
    expect(mocks.lastParams).toMatchObject({
      search: "apelacion",
      type: ["consultation", "written_submission"],
      status: ["active"],
      client: ["client-1"],
      member: ["user-1", "user-2"],
    });
  });

  test("uses Mis proyectos to replace member filters while preserving the rest of the portfolio", () => {
    renderPage(
      "/projects?groupBy=none&q=apelacion&type=consultation&status=active&client=client-1&member=user-2&orderBy=name&order=desc",
    );

    const shortcut = screen.getByRole("button", { name: "Mis proyectos" });
    expect(shortcut).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(shortcut);

    const location = new URL(
      screen.getByLabelText("Ruta actual").textContent ?? "",
      "https://orbit.test",
    );
    expect(location.searchParams.getAll("member")).toEqual(["user-1"]);
    expect(location.searchParams.get("q")).toBe("apelacion");
    expect(location.searchParams.getAll("type")).toEqual(["consultation"]);
    expect(location.searchParams.getAll("status")).toEqual(["active"]);
    expect(location.searchParams.getAll("client")).toEqual(["client-1"]);
    expect(location.searchParams.get("groupBy")).toBe("none");
    expect(location.searchParams.get("orderBy")).toBe("name");
    expect(location.searchParams.get("order")).toBe("desc");
    expect(shortcut).toHaveAttribute("aria-pressed", "true");
    expect(mocks.lastParams).toMatchObject({ member: ["user-1"] });
  });

  test("removes only the current user when Mis proyectos is deactivated", () => {
    renderPage(
      "/projects?groupBy=none&member=user-1&member=user-2&type=consultation",
    );

    const shortcut = screen.getByRole("button", { name: "Mis proyectos" });
    expect(shortcut).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(shortcut);

    const location = new URL(
      screen.getByLabelText("Ruta actual").textContent ?? "",
      "https://orbit.test",
    );
    expect(location.searchParams.getAll("member")).toEqual(["user-2"]);
    expect(location.searchParams.getAll("type")).toEqual(["consultation"]);
    expect(shortcut).toHaveAttribute("aria-pressed", "false");
    expect(mocks.lastParams).toMatchObject({
      type: ["consultation"],
      member: ["user-2"],
    });
  });

  test("uses a compact filter drawer and keeps multiple team selections", async () => {
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: 820,
    });
    renderPage("/projects?groupBy=none");

    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Filtrar proyectos" }),
      ).toBeInTheDocument(),
    );
    fireEvent.click(screen.getByRole("button", { name: "Filtrar proyectos" }));
    const drawer = screen.getByRole("dialog", { name: "Filtrar proyectos" });
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

    fireEvent.click(
      screen.getByRole("option", { name: "Miembros del equipo" }),
    );
    const firstMember = screen.getByRole("option", {
      name: /CG.*Cristian Granda/,
    });
    fireEvent.click(firstMember);
    expect(firstMember).toHaveAttribute("aria-checked", "true");
    fireEvent.click(screen.getByRole("option", { name: /MP.*María Pérez/ }));

    expect(mocks.lastParams).toMatchObject({ member: ["user-1", "user-2"] });
    expect(screen.getByLabelText("Ruta actual")).toHaveTextContent(
      "member=user-1&member=user-2",
    );

    fireEvent.keyDown(document, { key: "Escape" });
    expect(
      screen.queryByRole("dialog", { name: "Filtrar proyectos" }),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Filtrar proyectos/ }));
    expect(screen.getByRole("option", { name: "Estado" })).toBeVisible();
  });

  test("keeps project filters in a popover at the 1024px boundary", () => {
    renderPage("/projects?groupBy=none");

    fireEvent.click(screen.getByRole("button", { name: "Filtrar proyectos" }));
    expect(
      document.querySelector('[data-slot="popover-content"]'),
    ).toBeVisible();
    expect(document.querySelector('[data-slot="drawer-content"]')).toBeNull();
  });

  test("uses the responsive Drawer pattern for display options below 1024px", () => {
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: 820,
    });
    renderPage("/projects?groupBy=none");

    fireEvent.click(screen.getByRole("button", { name: "Opciones de vista" }));
    const drawer = screen.getByRole("dialog", { name: "Opciones de vista" });
    expect(drawer).toHaveAttribute("data-slot", "drawer-content");
    expect(drawer).toHaveClass(
      "data-[vaul-drawer-direction=bottom]:max-h-[85dvh]",
      "pb-[max(1rem,env(safe-area-inset-bottom))]",
    );
    expect(screen.getByRole("group", { name: "Agrupar por" })).toBeVisible();
  });

  test("keeps display options in a popover at the 1024px boundary", () => {
    renderPage("/projects?groupBy=none");

    fireEvent.click(screen.getByRole("button", { name: "Opciones de vista" }));
    expect(
      document.querySelector('[data-slot="popover-content"]'),
    ).toBeVisible();
    expect(document.querySelector('[data-slot="drawer-content"]')).toBeNull();
  });

  test("summarizes and clears multi-member filters from a chip", () => {
    renderPage(
      "/projects?groupBy=none&member=user-1&member=user-2&type=consultation",
    );

    expect(
      screen.getByRole("button", { name: "Miembros del equipo: CG + MP" }),
    ).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", {
        name: "Quitar filtro Miembros del equipo",
      }),
    );

    expect(mocks.lastParams).toMatchObject({ type: ["consultation"] });
    expect(mocks.lastParams).not.toHaveProperty("member");
    expect(screen.getByLabelText("Ruta actual")).not.toHaveTextContent(
      "member=",
    );
  });

  test("switches closed lifecycle tabs with their default order and controls", () => {
    renderPage();

    fireEvent.mouseDown(screen.getByRole("tab", { name: "Completados" }), {
      button: 0,
      ctrlKey: false,
    });
    expect(screen.getByLabelText("Ruta actual")).toHaveTextContent(
      "/projects?view=completed&orderBy=endDate&order=desc",
    );
    expect(
      screen.getByRole("heading", { name: "Proyectos completados" }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Opciones de vista" }));
    expect(
      within(screen.getByRole("group", { name: "Agrupar por" })).queryByRole(
        "radio",
        { name: "Estado" },
      ),
    ).not.toBeInTheDocument();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(mocks.lastGroupedParams).toEqual({
      view: "completed",
      orderBy: "endDate",
      order: "desc",
      page: 1,
      pageSize: 10,
    });
  });

  test("normalizes the removed cancelled view to the current portfolio", async () => {
    renderPage("/projects?view=cancelled");

    await waitFor(() =>
      expect(screen.getByLabelText("Ruta actual")).toHaveTextContent(
        "/projects?groupBy=client&orderBy=endDate&order=asc",
      ),
    );
    expect(
      screen.getByRole("heading", { name: "Proyectos en curso" }),
    ).toBeInTheDocument();
  });

  test("normalizes incompatible status grouping in a single-status view", async () => {
    renderPage(
      "/projects?view=completed&groupBy=status&status=active&orderBy=archivedAt&order=asc",
    );

    await waitFor(() =>
      expect(screen.getByLabelText("Ruta actual")).toHaveTextContent(
        "/projects?view=completed&groupBy=client&orderBy=endDate&order=desc",
      ),
    );
  });

  test("explains an empty completed lifecycle view", () => {
    renderPage("/projects?view=completed");

    expect(
      screen.getByText("Aún no hay proyectos completados"),
    ).toBeInTheDocument();
  });

  test("redirects the legacy action=create URL to the dedicated page", async () => {
    renderPage("/projects?view=archived&source=command&action=create");

    await waitFor(() =>
      expect(screen.getByLabelText("Ruta actual")).toHaveTextContent(
        "/projects/new",
      ),
    );
  });

  test("navigates to the dedicated creation page", () => {
    renderPage("/projects?source=portfolio");

    fireEvent.click(screen.getByRole("button", { name: "Nuevo proyecto" }));
    expect(screen.getByLabelText("Ruta actual")).toHaveTextContent(
      "/projects/new",
    );
  });

  test("shows project context, its compact period, and active team", () => {
    mocks.query.data = {
      projects: [project],
      pagination: { page: 1, pageSize: 25, total: 1, totalPages: 1 },
    };
    renderPage();

    const row = screen.getByRole("article", {
      name: "Apelación Constructora",
    });
    const projectCell = within(row).getByRole("button", {
      name: /Apelación Constructora/,
    });
    const startCell = within(row).getByLabelText("Inicio del proyecto");
    const endCell = within(row).getByLabelText("Fecha final del proyecto");
    const teamCell = within(row).getByRole("group", {
      name: "Equipo del proyecto",
    });

    expect(row).toHaveClass(
      "grid-cols-2",
      "lg:grid-cols-[minmax(0,1fr)_8.5rem_9.5rem_14rem]",
    );
    expect(projectCell).toHaveClass("col-span-2", "lg:col-span-1");
    expect(startCell).toHaveTextContent("Iniciojueves6 ago 2026");
    expect(endCell).toHaveTextContent("Finalviernes14 ago 2026");
    expect(teamCell).toContainElement(
      screen.getByLabelText("Equipo de Apelación Constructora"),
    );
    expect(
      within(projectCell).getByText("Apelación Constructora"),
    ).toBeInTheDocument();
    expect(
      within(projectCell).getByText(/Escrito \(Demanda\/Recurso\/Escrito\)/),
    ).toBeInTheDocument();
    expect(screen.getByText("Constructora del Sur S.A.")).toBeInTheDocument();
    expect(within(projectCell).getByText("Borrador")).toBeInTheDocument();
    expect(screen.queryByText("Planificada")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /eliminar|archivar/i }),
    ).not.toBeInTheDocument();
  });

  test("defaults to complete expandable client groups", () => {
    const secondProject = {
      ...project,
      id: "project-2",
      name: "Consulta contractual",
    };
    mocks.groupedData = {
      groups: [
        {
          client: project.client,
          projects: [project, secondProject],
        },
      ],
      pagination: { page: 1, pageSize: 10, total: 1, totalPages: 1 },
      projectTotal: 2,
    };

    renderPage("/projects?source=portfolio");

    expect(mocks.lastGroupedEnabled).toBe(true);
    expect(mocks.lastListEnabled).toBe(false);
    expect(mocks.lastGroupedParams).toEqual({
      view: "current",
      orderBy: "endDate",
      order: "asc",
      page: 1,
      pageSize: 10,
    });
    expect(screen.getAllByText("2 proyectos")).toHaveLength(2);
    expect(screen.getByText("Apelación Constructora")).toBeVisible();
    expect(screen.getByText("Consulta contractual")).toBeVisible();

    const disclosure = screen.getByRole("button", {
      name: "Contraer proyectos de Constructora del Sur S.A.",
    });
    expect(disclosure).toHaveAttribute("aria-expanded", "true");
    fireEvent.click(disclosure);
    expect(
      screen.getByRole("button", {
        name: "Expandir proyectos de Constructora del Sur S.A.",
      }),
    ).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("Consulta contractual")).not.toBeInTheDocument();
  });

  test("switches to the flat list through URL state and preserves parameters", () => {
    mocks.query.data = {
      projects: [project],
      pagination: { page: 1, pageSize: 25, total: 1, totalPages: 1 },
    };
    renderPage("/projects?source=command");

    chooseDisplayOption("Agrupar por", "Sin agrupar");

    expect(screen.getByLabelText("Ruta actual")).toHaveTextContent(
      "/projects?source=command&groupBy=none",
    );
    expect(mocks.lastListEnabled).toBe(true);
  });

  test("does not expose a client detail link until that route exists", () => {
    mocks.query.data = {
      projects: [project],
      pagination: { page: 1, pageSize: 25, total: 1, totalPages: 1 },
    };
    renderPage();

    expect(
      screen.queryByRole("link", {
        name: "Ver cliente Constructora del Sur S.A.",
      }),
    ).not.toBeInTheDocument();
  });

  test("defaults invalid grouping to client portfolios and paginates clients", () => {
    mocks.groupedData = {
      groups: [{ client: project.client, projects: [project] }],
      pagination: { page: 1, pageSize: 10, total: 12, totalPages: 2 },
      projectTotal: 37,
    };
    renderPage("/projects?groupBy=unexpected");

    fireEvent.click(screen.getByRole("button", { name: "Opciones de vista" }));
    expect(
      within(screen.getByRole("group", { name: "Agrupar por" })).getByRole(
        "radio",
        { name: "Cliente" },
      ),
    ).toHaveAttribute("aria-checked", "true");
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.getByText("37 proyectos")).toBeInTheDocument();
    expect(screen.getByText("Página 1 de 2 · 12 clientes")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Siguiente" }));
    expect(mocks.lastGroupedParams).toEqual({
      view: "current",
      orderBy: "endDate",
      order: "asc",
      page: 2,
      pageSize: 10,
    });
  });

  test("uses client grouping for archived projects", () => {
    renderPage("/projects?view=archived");

    expect(mocks.lastGroupedEnabled).toBe(true);
    expect(mocks.lastGroupedParams).toEqual({
      view: "archived",
      orderBy: "archivedAt",
      order: "desc",
      page: 1,
      pageSize: 10,
    });
  });

  test("shows active deadline urgency from the organization calendar date", () => {
    mocks.query.data = {
      projects: [
        {
          ...project,
          status: "active",
          endDate: "2026-08-09",
        },
      ],
      pagination: { page: 1, pageSize: 25, total: 1, totalPages: 1 },
    };
    renderPage("/projects", "2026-08-12");

    const row = screen.getByRole("article", {
      name: "Apelación Constructora",
    });
    expect(within(row).getByText("Fecha final excedida")).toBeVisible();
  });

  test("shows totals and requests the next page", () => {
    mocks.query.data = {
      projects: [project],
      pagination: { page: 1, pageSize: 25, total: 52, totalPages: 3 },
    };
    renderPage("/projects?groupBy=none");

    expect(screen.getByText("52 proyectos")).toBeInTheDocument();
    expect(screen.getByText("Página 1 de 3")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Anterior" })).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "Siguiente" }));
    expect(mocks.lastParams).toEqual({
      view: "current",
      orderBy: "endDate",
      order: "asc",
      page: 2,
      pageSize: 25,
    });
  });

  test("debounces search and resets filters to the first page", () => {
    vi.useFakeTimers();
    mocks.query.data = {
      projects: [project],
      pagination: { page: 1, pageSize: 25, total: 52, totalPages: 3 },
    };
    renderPage("/projects?groupBy=none");
    const search = screen.getByLabelText("Buscar proyectos");
    expect(search.closest("label")).toHaveClass("md:max-w-xl");
    expect(search.closest("label")).not.toHaveClass("md:max-w-md");
    const filterWrapper = search.closest("label")?.parentElement?.parentElement;
    expect(filterWrapper).toHaveClass("w-full", "flex-1");
    expect(filterWrapper?.parentElement).toHaveClass("lg:flex-row");
    expect(filterWrapper?.parentElement).not.toHaveClass("md:flex-row");
    expect(search).toHaveAttribute(
      "placeholder",
      "Buscar proyecto, tarea, cliente o referencia",
    );
    fireEvent.click(screen.getByRole("button", { name: "Siguiente" }));

    fireEvent.change(screen.getByLabelText("Buscar proyectos"), {
      target: { value: "Constructora" },
    });
    expect(mocks.lastParams).toEqual({
      view: "current",
      orderBy: "endDate",
      order: "asc",
      page: 1,
      pageSize: 25,
    });

    act(() => vi.advanceTimersByTime(300));
    expect(mocks.lastParams).toEqual({
      search: "Constructora",
      view: "current",
      orderBy: "endDate",
      order: "asc",
      page: 1,
      pageSize: 25,
    });
    act(() => vi.advanceTimersByTime(300));
    expect(screen.getByLabelText("Ruta actual")).toHaveTextContent(
      "q=Constructora",
    );
    expect(mocks.lastParams).toMatchObject({ search: "Constructora" });

    chooseProjectFilter(
      "Tipo de proyecto",
      "Escrito (Demanda/Recurso/Escrito)",
    );
    expect(mocks.lastParams).toEqual({
      search: "Constructora",
      type: ["written_submission"],
      view: "current",
      orderBy: "endDate",
      order: "asc",
      page: 1,
      pageSize: 25,
    });

    chooseProjectFilter("Estado", "Activo");
    expect(mocks.lastParams).toEqual({
      search: "Constructora",
      type: ["written_submission"],
      status: ["active"],
      view: "current",
      orderBy: "endDate",
      order: "asc",
      page: 1,
      pageSize: 25,
    });
  });

  test("keeps previous rows visible while a new page loads", () => {
    mocks.query.data = {
      projects: [project],
      pagination: { page: 1, pageSize: 25, total: 52, totalPages: 3 },
    };
    mocks.query.isPlaceholderData = true;
    renderPage("/projects?groupBy=none");

    expect(screen.getByText("Apelación Constructora")).toBeInTheDocument();
    expect(screen.getByText("Actualizando…")).toBeInTheDocument();
  });

  test("opens an existing project at its detail route", () => {
    mocks.query.data = {
      projects: [project],
      pagination: { page: 1, pageSize: 25, total: 1, totalPages: 1 },
    };
    renderPage();
    fireEvent.click(
      screen.getByRole("button", { name: /Apelación Constructora/ }),
    );

    expect(screen.getByLabelText("Ruta actual")).toHaveTextContent(
      "/projects/project-1",
    );
  });

  test("switches between current and archived views while preserving filters", () => {
    vi.useFakeTimers();
    renderPage("/projects?groupBy=none");
    expect(mocks.lastParams).toEqual({
      view: "current",
      orderBy: "endDate",
      order: "asc",
      page: 1,
      pageSize: 25,
    });

    fireEvent.change(screen.getByLabelText("Buscar proyectos"), {
      target: { value: "Consulta" },
    });
    act(() => vi.advanceTimersByTime(300));
    chooseProjectFilter("Estado", "Activo");
    fireEvent.mouseDown(screen.getByRole("tab", { name: "Archivados" }), {
      button: 0,
      ctrlKey: false,
    });

    expect(mocks.lastParams).toEqual({
      search: "Consulta",
      status: ["active"],
      view: "archived",
      orderBy: "archivedAt",
      order: "desc",
      page: 1,
      pageSize: 25,
    });
  });

  test("normalizes legacy calendar state into the list-only portfolio", async () => {
    renderPage(
      "/projects?display=calendar&month=2026-08&q=demanda&project=project-1&responsible=user-2&taskStatus=blocked&overdue=1&taskProject=project-1&task=task-1&source=dashboard",
    );

    expect(
      screen.queryByRole("tab", { name: "Calendario" }),
    ).not.toBeInTheDocument();
    expect(mocks.calendarProps).toBeUndefined();
    expect(mocks.portfolioProps).toBeUndefined();
    await waitFor(() =>
      expect(screen.getByLabelText("Ruta actual")).toHaveTextContent(
        "/projects?q=demanda&source=dashboard&groupBy=client&orderBy=endDate&order=asc",
      ),
    );
  });

  test("supports status grouping and explicit ordering in URL state", () => {
    renderPage("/projects?groupBy=status&orderBy=startDate&order=desc");

    fireEvent.click(screen.getByRole("button", { name: "Opciones de vista" }));
    expect(
      within(screen.getByRole("group", { name: "Agrupar por" })).getByRole(
        "radio",
        { name: "Estado" },
      ),
    ).toHaveAttribute("aria-checked", "true");
    expect(
      within(screen.getByRole("group", { name: "Ordenar por" })).getByRole(
        "radio",
        { name: "Fecha de inicio" },
      ),
    ).toHaveAttribute("aria-checked", "true");
    expect(screen.getByLabelText("Dirección del orden")).toHaveTextContent(
      "Descendente",
    );
    expect([
      ...new Set(
        mocks.listCalls
          .filter(({ enabled }) => enabled)
          .flatMap(({ params }) => params.status as string[]),
      ),
    ]).toEqual(["active", "draft"]);
  });

  test("replaces invalid portfolio parameters with current-list defaults", async () => {
    renderPage(
      "/projects?view=unexpected&groupBy=unexpected&orderBy=unexpected&order=sideways&source=link",
    );

    await waitFor(() =>
      expect(screen.getByLabelText("Ruta actual")).toHaveTextContent(
        "/projects?groupBy=client&orderBy=endDate&order=asc&source=link",
      ),
    );
  });

  test("marks archived projects and explains an empty archive", () => {
    mocks.query.data = {
      projects: [
        {
          ...project,
          status: "completed",
          archivedAt: "2026-08-10T12:00:00.000Z",
        },
      ],
      pagination: { page: 1, pageSize: 25, total: 1, totalPages: 1 },
    };
    const { unmount } = renderPage();
    expect(screen.getByText("Archivado")).toBeInTheDocument();
    expect(
      within(
        screen.getByRole("button", { name: /Apelación Constructora/ }),
      ).getByText("Completado"),
    ).toBeInTheDocument();

    unmount();
    mocks.query.data = {
      projects: [],
      pagination: { page: 1, pageSize: 25, total: 0, totalPages: 0 },
    };
    renderPage();
    fireEvent.mouseDown(screen.getByRole("tab", { name: "Archivados" }), {
      button: 0,
      ctrlKey: false,
    });
    expect(
      screen.getByText("Aún no hay proyectos archivados"),
    ).toBeInTheDocument();
  });
});
