import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { MyWorkPage } from "@/features/my-work/my-work-page";

const mocks = vi.hoisted(() => ({
  assigned: {} as Record<string, unknown>,
  supervision: {} as Record<string, unknown>,
  caseActions: {} as Record<string, unknown>,
  assignedParams: undefined as unknown,
  supervisionParams: undefined as unknown,
  update: vi.fn(),
  completeAction: vi.fn(),
  reopenAction: vi.fn(),
}));

const task = {
  id: "task-1",
  title: "Redactar demanda",
  status: "in_progress" as const,
  plannedStartDate: "2026-08-06",
  internalDueDate: "2026-08-09",
  updatedAt: "2026-08-08T10:00:00.000Z",
  group: "overdue" as const,
  project: {
    id: "project-1",
    name: "Apelación",
    client: { id: "client-1", name: "Constructora" },
  },
  stage: { id: "stage-1", name: "Redacción", position: 2 },
  responsibles: [
    {
      assignmentId: "a-1",
      userId: "user-1",
      userName: "Ana",
      userEmail: "ana@orbit.test",
      userAlias: "AT",
      userAvatarColor: "#4657d9",
      userPosition: "partner",
      activeStudioMember: true,
      assignedAt: "2026-08-01T10:00:00.000Z",
    },
  ],
};

vi.mock("@/lib/api/generated/my-work/my-work", () => ({
  getListMyAssignedTasksQueryKey: () => ["/api/my-work/tasks"],
  getListMySupervisionQueryKey: () => ["/api/my-work/supervision"],
  getListMyCaseActionsQueryKey: () => ["/api/my-work/case-actions"],
  useListMyAssignedTasks: (params: unknown) => {
    mocks.assignedParams = params;
    return mocks.assigned;
  },
  useListMySupervision: (params: unknown) => {
    mocks.supervisionParams = params;
    return mocks.supervision;
  },
  useListMyCaseActions: () => mocks.caseActions,
}));
vi.mock("@/lib/api/generated/case-actions/case-actions", () => ({
  useCompleteCaseAction: () => ({
    mutateAsync: mocks.completeAction,
    isPending: false,
  }),
  useReopenCaseAction: () => ({
    mutateAsync: mocks.reopenAction,
    isPending: false,
  }),
}));
vi.mock("@/lib/api/generated/cases/cases", () => ({
  useListCases: () => ({ data: { cases: [] } }),
}));
vi.mock(
  "@/lib/api/generated/project-tasks/project-tasks",
  async (original) => ({
    ...(await original<
      typeof import("@/lib/api/generated/project-tasks/project-tasks")
    >()),
    useUpdateProjectTask: () => ({
      mutateAsync: mocks.update,
      isPending: false,
    }),
    useListProjectTasks: (
      _projectId: string,
      _params: unknown,
      options?: { query?: { enabled?: boolean } },
    ) =>
      options?.query?.enabled
        ? {
            data: {
              tasks: [],
              pagination: { page: 1, pageSize: 25, total: 0, totalPages: 0 },
            },
            isPending: false,
            isError: false,
            refetch: vi.fn(),
          }
        : {
            data: undefined,
            isPending: true,
            isError: false,
            refetch: vi.fn(),
          },
  }),
);
vi.mock("@/features/projects/portfolio-task-sheet", () => ({
  PortfolioTaskSheet: ({ open }: { open: boolean }) =>
    open ? <div role="dialog">Detalle de tarea</div> : null,
}));
vi.mock("@/features/projects/project-task-status-select", () => ({
  ProjectTaskStatusSelect: ({
    taskTitle,
    onValueChange,
  }: {
    taskTitle: string;
    onValueChange(status: "completed"): void;
  }) => (
    <button
      type="button"
      aria-label={`Completar ${taskTitle}`}
      onClick={() => onValueChange("completed")}
    >
      Estado
    </button>
  ),
}));
vi.mock("@/features/my-work/my-work-filters", () => ({
  MyWorkFilters: ({ resultSummary }: { resultSummary?: string }) => (
    <div>
      Filtros personales
      {resultSummary ? <span>{resultSummary}</span> : null}
    </div>
  ),
}));

function renderPage(path = "/my-work") {
  const client = new QueryClient();
  const result = render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <MyWorkPage />
        <LocationProbe />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return { ...result, client };
}

function LocationProbe() {
  const location = useLocation();
  return (
    <output aria-label="Ruta actual">
      {location.pathname}
      {location.search}
    </output>
  );
}

describe("MyWorkPage", () => {
  beforeEach(() => {
    mocks.update.mockReset().mockResolvedValue({ task });
    mocks.assigned = {
      data: {
        today: "2026-08-10",
        tasks: [task],
        pagination: { page: 1, pageSize: 25, total: 1, totalPages: 1 },
      },
      isPending: false,
      isError: false,
      isFetching: false,
      refetch: vi.fn(),
    };
    mocks.supervision = {
      data: {
        today: "2026-08-10",
        projects: [
          {
            id: "project-1",
            name: "Apelación",
            client: { id: "client-1", name: "Constructora" },
            startDate: "2026-08-06",
            endDate: "2026-08-14",
            counts: {
              pending: 3,
              inProgress: 2,
              blocked: 0,
              completed: 5,
              unassigned: 1,
              total: 10,
            },
            attentionTasks: [task],
          },
        ],
        pagination: { page: 1, pageSize: 25, total: 1, totalPages: 1 },
      },
      isPending: false,
      isError: false,
      isFetching: false,
      refetch: vi.fn(),
    };
    mocks.caseActions = {
      data: {
        actions: [],
        pagination: { page: 1, pageSize: 25, total: 0, totalPages: 0 },
      },
      isPending: false,
      isError: false,
      isFetching: false,
      refetch: vi.fn(),
    };
  });

  test("renders assigned tasks as the default portfolio view", () => {
    renderPage();
    const pageHeading = screen.getByRole("heading", { name: "Mi trabajo" });
    expect(
      screen.getByText(
        "Tus tareas y los proyectos que supervisas, reunidos en un solo espacio.",
      ),
    ).toBeVisible();
    expect(pageHeading.closest('[data-slot="app-page"]')).toHaveClass(
      "py-6",
      "lg:py-8",
    );
    expect(
      pageHeading
        .closest('[data-slot="app-page-header"]')
        ?.querySelector("svg.lucide-list-todo"),
    ).toHaveAttribute("aria-hidden", "true");
    expect(
      pageHeading.closest('[data-slot="app-page-header"]')?.nextElementSibling,
    ).toHaveAttribute("data-slot", "app-page-content");
    expect(screen.getByRole("tab", { name: "Mis tareas" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(
      screen.getByRole("tab", { name: "Bajo mi supervisión" }),
    ).toHaveAttribute("aria-selected", "false");
    expect(screen.getByRole("heading", { name: "Mis tareas" })).toBeVisible();
    expect(
      screen.getByRole("region", { name: "Cartera de Mi trabajo" }),
    ).toBeVisible();
    expect(screen.getAllByText("1 tarea")).toHaveLength(2);
    expect(screen.getByRole("heading", { name: /Vencidas/ })).toBeVisible();
    expect(screen.getAllByText("Apelación")[0]).toBeVisible();
    expect(
      screen.getByText("Tareas en las que figuras como encargado activo."),
    ).toBeVisible();
    expect(
      screen.queryByText(
        "Proyectos donde eres supervisor principal o compartido.",
      ),
    ).not.toBeInTheDocument();
  });

  test("shows assigned case actions as the third personal view", () => {
    mocks.caseActions = {
      data: {
        actions: [
          {
            id: "action-1",
            description: "Preparar alegatos",
            status: "pending",
            updatedAt: "2026-09-03T12:00:00.000Z",
            completedAt: null,
            case: {
              id: "case-1",
              identification: "Proceso tributario",
              type: "judicial",
              client: { id: "client-1", name: "Cliente ejemplo" },
            },
          },
        ],
        pagination: { page: 1, pageSize: 25, total: 1, totalPages: 1 },
      },
      isPending: false,
      isError: false,
      isFetching: false,
      refetch: vi.fn(),
    };
    renderPage("/my-work?view=case-actions");
    expect(screen.getAllByText("Acciones de casos").length).toBeGreaterThan(0);
    expect(screen.getByText("Cliente ejemplo")).toBeVisible();
    expect(
      screen.getByRole("link", { name: "Proceso tributario" }),
    ).toHaveAttribute("href", "/cases/case-1");
    expect(screen.getByText("Preparar alegatos")).toBeVisible();
  });

  test("labels tasks inside the current Monday-Sunday week", () => {
    mocks.assigned = {
      ...mocks.assigned,
      data: {
        ...(mocks.assigned.data as object),
        tasks: [{ ...task, group: "this_week" }],
      },
    };

    renderPage();

    expect(screen.getByRole("heading", { name: /Esta semana/ })).toBeVisible();
    expect(
      screen.queryByRole("heading", { name: /Próximos 7 días/ }),
    ).not.toBeInTheDocument();
  });

  test("renders the calendar scope used by every assigned-task section", () => {
    const groups = [
      "overdue",
      "today",
      "this_week",
      "future",
      "undated",
      "completed",
    ] as const;
    mocks.assigned = {
      ...mocks.assigned,
      data: {
        ...(mocks.assigned.data as object),
        today: "2026-08-18",
        tasks: groups.map((group, index) => ({
          ...task,
          id: `task-${group}`,
          title: `Tarea ${index + 1}`,
          group,
        })),
        pagination: { page: 1, pageSize: 25, total: 6, totalPages: 1 },
      },
    };

    renderPage();

    expect(screen.getByText("Hasta 17 ago 2026")).toBeVisible();
    expect(screen.getByText("18 ago 2026")).toBeVisible();
    expect(screen.getByText("17-23 ago 2026")).toBeVisible();
    expect(screen.getByText("Desde 24 ago 2026")).toBeVisible();
    expect(screen.getByText("Sin periodo completo")).toBeVisible();
    expect(screen.getByText("Cualquier periodo")).toBeVisible();
  });

  test("groups temporal tasks by client and project before their task rows", () => {
    const secondTask = {
      ...task,
      id: "task-2",
      title: "Revisar anexos",
    };
    const otherProjectTask = {
      ...task,
      id: "task-3",
      title: "Preparar informe",
      project: {
        id: "project-2",
        name: "Consulta tributaria",
        client: { id: "client-2", name: "Mina Andina" },
      },
    };
    mocks.assigned = {
      ...mocks.assigned,
      data: {
        ...(mocks.assigned.data as object),
        tasks: [task, otherProjectTask, secondTask],
        pagination: { page: 1, pageSize: 25, total: 3, totalPages: 1 },
      },
    };

    renderPage();
    const temporalGroup = screen.getByRole("region", { name: /Vencidas/ });
    const appealGroup = within(temporalGroup).getByRole("group", {
      name: "Constructora, Apelación, 2 tareas",
    });
    const otherGroup = within(temporalGroup).getByRole("group", {
      name: "Mina Andina, Consulta tributaria, 1 tarea",
    });
    const appealText = appealGroup.textContent ?? "";

    expect(appealText.indexOf("Constructora")).toBeLessThan(
      appealText.indexOf("Apelación"),
    );
    expect(appealText.indexOf("Apelación")).toBeLessThan(
      appealText.indexOf("Redactar demanda"),
    );
    expect(appealGroup).toHaveTextContent("Redactar demanda");
    expect(appealGroup).toHaveTextContent("Revisar anexos");
    expect(appealGroup).not.toHaveTextContent("Consulta tributaria");
    expect(otherGroup).toHaveTextContent("Preparar informe");
    expect(within(appealGroup).getAllByText("Constructora")).toHaveLength(1);
    expect(within(appealGroup).getAllByText("Apelación")).toHaveLength(1);
    expect(within(appealGroup).getAllByRole("article")).toHaveLength(2);
    expect(
      within(appealGroup).getAllByRole("img", { name: "Ana" })[0],
    ).toHaveTextContent("AT");
    expect(
      within(appealGroup).getAllByRole("link", { name: /AT, Ana/ })[0],
    ).toHaveAttribute("href", "/team/user-1");
  });

  test("shows weekdays for supervised project dates", () => {
    renderPage("/my-work?view=supervision");

    expect(screen.getByText("jueves")).toBeVisible();
    expect(screen.getByText("viernes")).toBeVisible();
    expect(screen.getByText("6 ago 2026").parentElement).toHaveTextContent(
      "Iniciojueves6 ago 2026",
    );
    expect(screen.getByText("14 ago 2026").parentElement).toHaveTextContent(
      "Finalviernes14 ago 2026",
    );
  });

  test("switches to supervision in the URL and expands a compact project row", async () => {
    renderPage("/my-work?q=apelacion");

    fireEvent.mouseDown(
      screen.getByRole("tab", { name: "Bajo mi supervisión" }),
      { button: 0, ctrlKey: false },
    );
    await waitFor(() =>
      expect(screen.getByLabelText("Ruta actual")).toHaveTextContent(
        "/my-work?q=apelacion&view=supervision",
      ),
    );
    expect(
      screen.getByRole("heading", { name: "Bajo mi supervisión" }),
    ).toBeVisible();
    expect(screen.getByText("1 proyecto")).toBeVisible();
    expect(
      screen.queryByRole("heading", { name: /Vencidas/ }),
    ).not.toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: "Ver tareas de Apelación" }),
    );
    expect(screen.getByText("Requieren atención")).toBeVisible();
    expect(screen.getAllByText("Constructora")).toHaveLength(1);
    expect(screen.getAllByText("Apelación")).toHaveLength(1);
    const supervisionRow = screen.getByRole("button", {
      name: "Ocultar tareas de Apelación",
    }).parentElement?.parentElement;
    expect(supervisionRow).toHaveClass(
      "lg:grid-cols-[minmax(12rem,1fr)_7rem_7.5rem_minmax(12rem,15rem)]",
      "xl:grid-cols-[minmax(14rem,1fr)_7.5rem_8rem_minmax(15rem,18rem)]",
      "lg:items-center",
    );
    const progress = screen.getByRole("group", {
      name: "Progreso de tareas en Apelación",
    });
    expect(within(progress).getByText("Pendientes")).toHaveTextContent("3");
    expect(within(progress).getByText("En trabajo")).toHaveTextContent("2");
    expect(within(progress).getByText("Suspendidas")).toHaveTextContent("0");
    expect(within(progress).getByText("Completadas")).toHaveTextContent("5");
    expect(within(progress).getByText(/Sin encargado/)).toHaveTextContent("1");
    expect(
      screen.getByRole("button", { name: "Abrir Redactar demanda" }),
    ).toBeVisible();
    expect(screen.getByLabelText("Ruta actual")).toHaveTextContent(
      "expanded=project-1",
    );
  });

  test("explains an expanded project with no attention tasks before loading all", () => {
    const project = (
      mocks.supervision as {
        data: { projects: Array<{ attentionTasks: (typeof task)[] }> };
      }
    ).data.projects[0];
    project.attentionTasks = [];
    renderPage("/my-work?view=supervision");

    fireEvent.click(
      screen.getByRole("button", { name: "Ver tareas de Apelación" }),
    );
    expect(
      screen.getByText(
        "No hay tareas que requieran atención con estos filtros.",
      ),
    ).toBeVisible();
    expect(
      screen.queryByLabelText("Cargando tareas del proyecto"),
    ).not.toBeInTheDocument();
  });

  test("passes URL filters and independent pages to both queries", () => {
    renderPage(
      "/my-work?q=demanda&project=p1&status=blocked&from=2026-08-01&to=2026-08-20&completed=1&assignedPage=2&supervisionPage=3",
    );
    expect(mocks.assignedParams).toMatchObject({
      page: 2,
      pageSize: 25,
      search: "demanda",
      projectId: ["p1"],
      status: ["blocked"],
      dateFrom: "2026-08-01",
      dateTo: "2026-08-20",
      includeCompleted: "true",
    });
    expect(mocks.supervisionParams).toMatchObject({ page: 3, pageSize: 25 });
  });

  test("opens the existing task sheet from an assigned task", () => {
    renderPage();
    fireEvent.click(
      screen.getByRole("button", { name: "Abrir Redactar demanda" }),
    );
    expect(screen.getByRole("dialog")).toHaveTextContent("Detalle de tarea");
  });

  test("shows loading and errors only for the active view", () => {
    mocks.assigned = {
      data: undefined,
      isPending: true,
      isError: false,
      isFetching: true,
      refetch: vi.fn(),
    };
    mocks.supervision = {
      data: undefined,
      isPending: false,
      isError: true,
      isFetching: false,
      refetch: vi.fn(),
    };
    renderPage("/my-work?view=supervision");
    expect(
      screen.queryByLabelText("Cargando mis tareas"),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText("No pudimos cargar tus proyectos supervisados."),
    ).toBeVisible();
  });

  test("updates task status and invalidates personal and shared task views", async () => {
    const { client } = renderPage();
    const invalidate = vi.spyOn(client, "invalidateQueries");
    fireEvent.click(
      screen.getByRole("button", { name: "Completar Redactar demanda" }),
    );
    await waitFor(() =>
      expect(mocks.update).toHaveBeenCalledWith({
        projectId: "project-1",
        taskId: "task-1",
        data: { status: "completed" },
      }),
    );
    expect(
      invalidate.mock.calls.map(([options]) => options?.queryKey?.[0]),
    ).toEqual(
      expect.arrayContaining([
        "/api/my-work/tasks",
        "/api/my-work/supervision",
        "/api/project-tasks/calendar",
      ]),
    );
    expect(
      invalidate.mock.calls.map(([options]) => options?.queryKey?.[0]),
    ).not.toContain("/api/dashboard/overview");
  });
});
