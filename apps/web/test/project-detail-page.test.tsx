import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { RefObject } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { ProjectDetailPage } from "@/features/projects/project-detail-page";
import { OrganizationCalendarProvider } from "@/features/organization/organization-calendar-context";
import type { Project } from "@/lib/api/generated/models/project";
import { ApiClientError } from "@/lib/api/fetcher";

const project = {
  id: "project-1",
  client: { id: "client-1", name: "Constructora del Sur S.A." },
  name: "Apelación Constructora",
  type: "written_submission" as const,
  status: "draft" as const,
  startDate: "2026-08-06",
  endDate: "2026-08-17",
  internalReference: "EXP-2026-014",
  description: "Impugnación de la resolución de primera instancia.",
  archivedAt: null as string | null,
  createdAt: "2026-08-05T10:00:00.000Z",
  updatedAt: "2026-08-05T10:00:00.000Z",
};

const mocks = vi.hoisted(() => ({
  query: {
    data: undefined as undefined | { project: Project },
    error: null as unknown,
    isPending: false,
    isError: false,
    refetch: vi.fn(),
  },
  update: vi.fn(),
  archive: vi.fn(),
  restore: vi.fn(),
  archivePending: false,
  restorePending: false,
  requestedId: "",
  tasksProjectStartDate: "",
  tasksOpenerRef: null as RefObject<HTMLElement | null> | null,
  activityOpenerRef: null as RefObject<HTMLElement | null> | null,
  childReadOnly: [] as boolean[],
  schedule: {
    data: undefined as
      | undefined
      | {
          stages: Array<{
            id: string;
            tasks: Array<{ id: string; status: string }>;
          }>;
        },
    isPending: false,
    isError: false,
  },
}));

vi.mock("@/lib/api/generated/projects/projects", () => ({
  getGetProjectQueryKey: (projectId: string) => [`/api/projects/${projectId}`],
  getListProjectsQueryKey: () => ["/api/projects"],
  useGetProject: (projectId: string) => {
    mocks.requestedId = projectId;
    return mocks.query;
  },
  useUpdateProject: () => ({ mutateAsync: mocks.update, isPending: false }),
  useArchiveProject: () => ({
    mutateAsync: mocks.archive,
    isPending: mocks.archivePending,
  }),
  useRestoreProject: () => ({
    mutateAsync: mocks.restore,
    isPending: mocks.restorePending,
  }),
}));

vi.mock("@/lib/api/generated/activity/activity", () => ({
  getListProjectActivitiesQueryKey: (projectId: string) => [
    `/api/projects/${projectId}/activities`,
  ],
}));

vi.mock("@/lib/api/generated/project-tasks/project-tasks", () => ({
  useGetProjectTaskSchedule: () => mocks.schedule,
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
      <p>{`Formulario ${initialProject?.id ?? "nuevo"}`}</p>
      <button
        type="button"
        onClick={() =>
          void onSubmit({
            name: "Apelación Constructora",
            clientId: "client-1",
            type: "written_submission",
            status: "active",
            startDate: "2026-08-06",
            endDate: "2026-08-17",
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

vi.mock("@/features/projects/project-stages", () => ({
  ProjectStages: ({
    projectId,
    readOnly,
  }: {
    projectId: string;
    readOnly?: boolean;
  }) => {
    mocks.childReadOnly.push(Boolean(readOnly));
    return (
      <section>
        <h2>Etapas</h2>
        <p>{`Etapas ${projectId}`}</p>
      </section>
    );
  },
}));

vi.mock("@/features/projects/project-team", () => ({
  ProjectTeam: ({
    projectId,
    readOnly,
  }: {
    projectId: string;
    readOnly?: boolean;
  }) => {
    mocks.childReadOnly.push(Boolean(readOnly));
    return (
      <section>
        <h2>Equipo del proyecto</h2>
        <p>{`Equipo ${projectId}`}</p>
      </section>
    );
  },
}));

vi.mock("@/features/projects/project-activity-feed", () => ({
  ProjectActivityFeed: ({
    projectId,
    taskOpenerRef,
  }: {
    projectId: string;
    taskOpenerRef: RefObject<HTMLElement | null>;
  }) => {
    mocks.activityOpenerRef = taskOpenerRef;
    return (
      <section>
        <h2>Actividad</h2>
        <p>{`Actividad ${projectId}`}</p>
      </section>
    );
  },
}));

vi.mock("@/features/projects/project-tasks", () => ({
  ProjectTasks: ({
    projectId,
    projectStartDate,
    projectStatus,
    taskOpenerRef,
    readOnly,
  }: {
    projectId: string;
    projectStartDate: string;
    projectStatus: string;
    taskOpenerRef: RefObject<HTMLElement | null>;
    readOnly?: boolean;
  }) => {
    mocks.tasksProjectStartDate = projectStartDate;
    void projectStatus;
    mocks.tasksOpenerRef = taskOpenerRef;
    mocks.childReadOnly.push(Boolean(readOnly));
    return (
      <section>
        <h2>Tareas</h2>
        <p>{`Tareas ${projectId}`}</p>
      </section>
    );
  },
}));

function renderPage(path = "/projects/project-1") {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const invalidate = vi.spyOn(queryClient, "invalidateQueries");

  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[path]}>
        <OrganizationCalendarProvider
          timeZone="America/Lima"
          now={new Date("2026-08-12T17:00:00.000Z")}
        >
          <Routes>
            <Route
              path="/projects/:projectId"
              element={<ProjectDetailPage />}
            />
          </Routes>
        </OrganizationCalendarProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );

  return { invalidate };
}

describe("ProjectDetailPage", () => {
  beforeEach(() => {
    mocks.query.data = { project };
    mocks.query.error = null;
    mocks.query.isPending = false;
    mocks.query.isError = false;
    mocks.query.refetch.mockReset().mockResolvedValue(undefined);
    mocks.update
      .mockReset()
      .mockResolvedValue({ project: { ...project, status: "active" } });
    mocks.archive.mockReset().mockResolvedValue({
      project: { ...project, archivedAt: "2026-08-10T12:00:00.000Z" },
    });
    mocks.restore.mockReset().mockResolvedValue({ project });
    mocks.archivePending = false;
    mocks.restorePending = false;
    mocks.requestedId = "";
    mocks.tasksProjectStartDate = "";
    mocks.tasksOpenerRef = null;
    mocks.activityOpenerRef = null;
    mocks.childReadOnly = [];
    mocks.schedule.data = undefined;
    mocks.schedule.isPending = false;
    mocks.schedule.isError = false;
  });

  test("loads the requested project", () => {
    mocks.query.isPending = true;
    mocks.query.data = undefined;
    renderPage("/projects/project-7");

    expect(mocks.requestedId).toBe("project-7");
    expect(
      screen
        .getByLabelText("Cargando proyecto")
        .closest('[data-slot="app-page"]'),
    ).toHaveClass("max-w-384");
  });

  test("labels the project workspace without redundant operational wording", () => {
    renderPage();

    expect(
      screen.getByRole("region", { name: "Panel del proyecto" }),
    ).toBeVisible();
  });

  test("offers retry after a recoverable query failure", () => {
    mocks.query.data = undefined;
    mocks.query.isError = true;
    mocks.query.error = new ApiClientError("falló", {
      kind: "network",
      retryable: true,
    });
    renderPage();

    expect(
      screen
        .getByText("No pudimos cargar el proyecto")
        .closest('[data-slot="app-page"]'),
    ).toHaveClass("max-w-384");
    fireEvent.click(screen.getByRole("button", { name: "Intentar de nuevo" }));
    expect(mocks.query.refetch).toHaveBeenCalledOnce();
  });

  test("uses the tenant-safe not-found state for HTTP 404", () => {
    mocks.query.data = undefined;
    mocks.query.isError = true;
    mocks.query.error = new ApiClientError("no encontrado", {
      kind: "http",
      status: 404,
      retryable: false,
    });
    renderPage();

    expect(
      screen.getByRole("heading", { name: "Proyecto no encontrado" }),
    ).toBeInTheDocument();
    expect(
      screen
        .getByRole("heading", { name: "Proyecto no encontrado" })
        .closest('[data-slot="app-page"]'),
    ).toHaveClass("max-w-384");
    expect(
      screen.queryByRole("button", { name: "Intentar de nuevo" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Volver a proyectos" }),
    ).toHaveAttribute("href", "/projects");
  });

  test("keeps one accent configuration action in the project header", () => {
    renderPage();

    expect(
      screen.getByRole("heading", { name: project.name }),
    ).toBeInTheDocument();
    expect(
      screen
        .getByRole("heading", { name: project.name })
        .closest('[data-slot="app-page"]'),
    ).toHaveClass("max-w-384");
    const configure = screen.getByRole("link", {
      name: "Configurar proyecto",
    });
    expect(configure).toHaveAttribute("href", "/projects/project-1/settings");
    expect(configure).toHaveAttribute("data-variant", "default");
    expect(
      screen.queryByRole("button", { name: "Editar proyecto" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Archivar proyecto" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Restaurar proyecto" }),
    ).not.toBeInTheDocument();
  });

  test("puts operational work before activity and moves setup out of the main flow", () => {
    renderPage();

    const tasks = screen.getByText("Tareas project-1");
    const activity = screen.getByText("Actividad project-1");
    expect(
      tasks.compareDocumentPosition(activity) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    const configure = screen.getByRole("link", {
      name: "Configurar proyecto",
    });
    expect(configure).toHaveAttribute("href", "/projects/project-1/settings");
    expect(configure).toHaveAttribute("data-variant", "default");
    expect(
      screen.queryByRole("tab", { name: "Etapas" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("tab", { name: "Equipo" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("Etapas project-1")).not.toBeInTheDocument();
    expect(screen.queryByText("Equipo project-1")).not.toBeInTheDocument();

    expect(mocks.tasksOpenerRef).toBeDefined();
    expect(mocks.tasksOpenerRef).not.toBeNull();
    expect(mocks.activityOpenerRef).toBe(mocks.tasksOpenerRef);
    expect(mocks.tasksProjectStartDate).toBe("2026-08-06");
  });

  test("places the completion suggestion before the operational tasks", () => {
    mocks.query.data = { project: { ...project, status: "active" } };
    mocks.schedule.data = {
      stages: [
        {
          id: "stage-1",
          tasks: [{ id: "task-1", status: "completed" }],
        },
      ],
    };
    renderPage();

    const suggestion = screen.getByText(
      "Todas las tareas del proyecto están completadas.",
    );
    const tasks = screen.getByText("Tareas project-1");
    expect(
      suggestion.compareDocumentPosition(tasks) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  test("keeps only configuration available for an archived project", () => {
    mocks.query.data = {
      project: { ...project, archivedAt: "2026-08-10T12:00:00.000Z" },
    };
    renderPage();

    const configure = screen.getByRole("link", {
      name: "Configurar proyecto",
    });
    expect(configure).toHaveAttribute("href", "/projects/project-1/settings");
    expect(configure).toHaveAttribute("data-variant", "default");
    expect(
      screen.getByText("Este proyecto está archivado y es de solo lectura."),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Editar proyecto" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Restaurar proyecto" }),
    ).not.toBeInTheDocument();
    expect(mocks.childReadOnly).toContain(true);
  });
});
