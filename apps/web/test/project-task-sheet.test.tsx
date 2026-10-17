import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createRef } from "react";
import {
  QueryClient,
  QueryClientProvider,
  QueryObserver,
} from "@tanstack/react-query";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { ProjectTaskSheet } from "@/features/projects/project-task-sheet";
import type {
  ProjectAssignment,
  ProjectStage,
  ProjectTask,
} from "@/lib/api/generated/models";

const stages: ProjectStage[] = [
  {
    id: "stage-1",
    name: "Investigación",
    description: null,
    position: 0,
    createdAt: "2026-08-06T10:00:00.000Z",
    updatedAt: "2026-08-06T10:00:00.000Z",
  },
  {
    id: "stage-2",
    name: "Recurso",
    description: null,
    position: 1,
    createdAt: "2026-08-06T10:00:00.000Z",
    updatedAt: "2026-08-06T10:00:00.000Z",
  },
];

const assignments: ProjectAssignment[] = [
  {
    id: "project-assignment-1",
    userId: "user-2",
    userName: "Luis Ramos",
    userEmail: "luis@orbit.pe",
    userAlias: "LR",
    userAvatarColor: "#11182b",
    activeStudioMember: true,
    responsibility: "member",
    assignedByUserId: "user-1",
    assignedByName: "Ana Torres",
    assignedAt: "2026-08-06T20:00:00.000Z",
    endedAt: null,
    endedByUserId: null,
    endedByName: null,
    endReason: null,
  },
];

const activeTask: ProjectTask = {
  id: "task-1",
  stage: { id: "stage-1", name: "Investigación", position: 0 },
  title: "Preparar recurso",
  description: "Revisar los fundamentos de la apelación.",
  status: "in_progress",
  plannedStartDate: "2026-08-07",
  internalDueDate: "2026-08-14",
  position: 0,
  archivedAt: null,
  responsibles: [
    {
      assignmentId: "task-assignment-1",
      userId: "user-2",
      userName: "Luis Ramos",
      userEmail: "luis@orbit.pe",
      userAlias: "LR",
      userAvatarColor: "#11182b",
      userPosition: "junior",
      activeStudioMember: true,
      assignedAt: "2026-08-06T20:00:00.000Z",
    },
  ],
  createdAt: "2026-08-06T20:00:00.000Z",
  updatedAt: "2026-08-06T20:00:00.000Z",
};

async function taskRefetchResult(
  cachedTask: ProjectTask,
  queryFn: () => Promise<{ task: ProjectTask }>,
) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const queryKey = ["task-refetch-result"];
  queryClient.setQueryData(queryKey, { task: cachedTask });
  const observer = new QueryObserver(queryClient, { queryKey, queryFn });
  const result = await observer.refetch();
  observer.destroy();
  queryClient.clear();
  return result;
}

const orbitTheme = readFileSync(
  resolve(process.cwd(), "src/styles/globals.css"),
  "utf8",
);

function cssColor(token: string) {
  const match = orbitTheme.match(
    new RegExp(`${token}:\\s*(#[0-9a-f]{6});`, "i"),
  );
  if (!match) throw new Error(`Expected ${token} to be a six-digit hex color`);
  return match[1];
}

function relativeLuminance(hex: string) {
  const channels = hex
    .slice(1)
    .match(/../g)
    ?.map((channel) => Number.parseInt(channel, 16) / 255);
  if (!channels || channels.length !== 3) {
    throw new Error(`Expected a six-digit hex color, received ${hex}`);
  }
  const [red, green, blue] = channels.map((channel) =>
    channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4,
  );
  return red * 0.2126 + green * 0.7152 + blue * 0.0722;
}

function contrastRatio(first: string, second: string) {
  const [lighter, darker] = [
    relativeLuminance(first),
    relativeLuminance(second),
  ].sort((left, right) => right - left);
  return (lighter + 0.05) / (darker + 0.05);
}

const mocks = vi.hoisted(() => ({
  taskQuery: {
    data: undefined as undefined | { task: ProjectTask },
    isPending: false,
    isError: false,
    isRefetchError: false,
    error: null as unknown,
    refetch: vi.fn(),
  },
  taskQueryArgs: undefined as unknown,
  stagesQuery: {
    data: undefined as undefined | { stages: ProjectStage[] },
    isPending: false,
    isError: false,
    refetch: vi.fn(),
  },
  assignmentsQuery: {
    data: undefined as
      | undefined
      | {
          active: ProjectAssignment[];
          history: ProjectAssignment[];
          historyPagination: {
            page: number;
            pageSize: number;
            total: number;
            totalPages: number;
          };
        },
    isPending: false,
    isError: false,
    refetch: vi.fn(),
  },
  update: vi.fn(),
  replace: vi.fn(),
  restore: vi.fn(),
}));

vi.mock("@/lib/api/generated/project-tasks/project-tasks", () => ({
  useGetProjectTask: (projectId: string, taskId: string, options: unknown) => {
    mocks.taskQueryArgs = { projectId, taskId, options };
    return mocks.taskQuery;
  },
  getGetProjectTaskQueryKey: (projectId: string, taskId: string) => [
    `/api/projects/${projectId}/tasks/${taskId}`,
  ],
  getGetProjectTaskScheduleQueryKey: (projectId: string) => [
    `/api/projects/${projectId}/task-schedule`,
  ],
  getListProjectTasksQueryKey: (projectId: string) => [
    `/api/projects/${projectId}/tasks`,
  ],
  useUpdateProjectTask: () => ({
    mutateAsync: mocks.update,
    isPending: false,
  }),
  useReplaceProjectTaskResponsibles: () => ({
    mutateAsync: mocks.replace,
    isPending: false,
  }),
  useRestoreProjectTask: () => ({
    mutateAsync: mocks.restore,
    isPending: false,
  }),
}));

vi.mock("@/lib/api/generated/project-stages/project-stages", () => ({
  useListProjectStages: () => mocks.stagesQuery,
}));

vi.mock(
  "@/lib/api/generated/project-collaboration/project-collaboration",
  () => ({
    useListProjectAssignments: () => mocks.assignmentsQuery,
  }),
);

vi.mock("@/lib/api/generated/activity/activity", () => ({
  getListProjectActivitiesQueryKey: (projectId: string) => [
    `/api/projects/${projectId}/activities`,
  ],
}));

function renderSheet(
  props: Partial<React.ComponentProps<typeof ProjectTaskSheet>> = {},
) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const invalidate = vi.spyOn(queryClient, "invalidateQueries");
  const onOpenChange = vi.fn();
  const onSaved = vi.fn();
  const openerRef = createRef<HTMLButtonElement>();
  const sheetProps: React.ComponentProps<typeof ProjectTaskSheet> = {
    projectId: "project-1",
    projectStartDate: "2026-08-06",
    taskId: "task-1",
    open: true,
    onOpenChange,
    onSaved,
    openerRef,
    ...props,
  };
  const view = render(
    <MemoryRouter>
      <QueryClientProvider client={queryClient}>
        <main data-testid="surrounding-page">
          Contenido del proyecto
          <button ref={openerRef}>Abrir tarea</button>
        </main>
        <ProjectTaskSheet {...sheetProps} />
      </QueryClientProvider>
    </MemoryRouter>,
  );

  return {
    ...view,
    invalidate,
    opener: openerRef.current!,
    onOpenChange,
    onSaved,
    queryClient,
    rerenderSheet(
      nextProps: Partial<React.ComponentProps<typeof ProjectTaskSheet>> = {},
    ) {
      Object.assign(sheetProps, nextProps);
      view.rerender(
        <MemoryRouter>
          <QueryClientProvider client={queryClient}>
            <main data-testid="surrounding-page">
              Contenido del proyecto
              <button ref={openerRef}>Abrir tarea</button>
            </main>
            <ProjectTaskSheet {...sheetProps} />
          </QueryClientProvider>
        </MemoryRouter>,
      );
    },
  };
}

describe("ProjectTaskSheet", () => {
  test("shows active tasks as read-only inside an archived project", () => {
    renderSheet({ readOnly: true });

    expect(
      screen.getByText("Revisar los fundamentos de la apelación."),
    ).toBeInTheDocument();
    expect(screen.getByText("Fecha límite")).toBeInTheDocument();
    expect(screen.getByText("Encargados")).toBeInTheDocument();
    expect(screen.queryByText("Fecha límite interna")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Título")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Guardar cambios" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Restaurar" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("Archivada")).not.toBeInTheDocument();
  });

  beforeEach(() => {
    mocks.taskQuery.data = { task: activeTask };
    mocks.taskQuery.isPending = false;
    mocks.taskQuery.isError = false;
    mocks.taskQuery.isRefetchError = false;
    mocks.taskQuery.error = null;
    mocks.taskQuery.refetch.mockReset().mockResolvedValue({
      data: { task: activeTask },
    });
    mocks.stagesQuery.data = { stages };
    mocks.stagesQuery.isPending = false;
    mocks.stagesQuery.isError = false;
    mocks.stagesQuery.refetch.mockReset().mockResolvedValue(undefined);
    mocks.assignmentsQuery.data = {
      active: assignments,
      history: [],
      historyPagination: { page: 1, pageSize: 1, total: 0, totalPages: 0 },
    };
    mocks.assignmentsQuery.isPending = false;
    mocks.assignmentsQuery.isError = false;
    mocks.assignmentsQuery.refetch.mockReset().mockResolvedValue(undefined);
    mocks.update.mockReset().mockResolvedValue({ task: activeTask });
    mocks.replace.mockReset().mockResolvedValue({ task: activeTask });
    mocks.restore.mockReset().mockResolvedValue({ task: activeTask });
  });

  test("links portfolio tasks to their project with legal-work context", () => {
    const { onOpenChange } = renderSheet({
      projectContext: {
        name: "Recurso Runa",
        clientName: "Runa Card SAC",
      },
    });

    const context = screen.getByLabelText("Contexto del proyecto");
    expect(within(context).getByText("Recurso Runa")).toBeVisible();
    expect(within(context).getByText("Runa Card SAC")).toBeVisible();
    expect(within(context).getByText(activeTask.stage.name)).toBeVisible();

    const projectLink = screen.getByRole("link", { name: "Ver proyecto" });
    expect(projectLink).toHaveAttribute("href", "/projects/project-1");

    fireEvent.click(projectLink);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  test("omits portfolio navigation inside the project detail", () => {
    renderSheet();

    expect(
      screen.queryByRole("link", { name: "Ver proyecto" }),
    ).not.toBeInTheDocument();
  });

  test("loads an active task into the existing editable form", async () => {
    mocks.taskQuery.data = undefined;
    mocks.taskQuery.isPending = true;
    const { rerenderSheet } = renderSheet();

    expect(
      screen.getByRole("dialog", { name: "Cargando tarea" }),
    ).toBeVisible();
    expect(screen.getByLabelText("Cargando detalle de tarea")).toBeVisible();

    mocks.taskQuery.data = { task: activeTask };
    mocks.taskQuery.isPending = false;
    rerenderSheet();

    expect(
      await screen.findByRole("dialog", { name: "Preparar recurso" }),
    ).toBeVisible();
    expect(
      screen.getByText("Edita los datos de esta tarea."),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Guardar cambios" }),
    ).toBeEnabled();
    expect(screen.getByRole("button", { name: "Cerrar" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Cerrar" })).toHaveClass(
      "min-h-11",
      "min-w-11",
    );
    expect(screen.getByText("Cerrar")).toHaveClass("sm:sr-only");
    expect(
      screen.getByText("Edita los datos de esta tarea.").parentElement,
    ).toHaveClass("pr-24", "sm:pr-14");
    expect(screen.getByRole("dialog")).toHaveClass(
      "w-[calc(100vw-1rem)]",
      "overflow-y-auto",
      "overscroll-contain",
      "sm:max-w-xl",
      "lg:max-w-2xl",
    );
    expect(mocks.taskQueryArgs).toMatchObject({
      projectId: "project-1",
      taskId: "task-1",
      options: { query: { enabled: true } },
    });
  });

  test("keeps a legacy task date visible when it predates the project", () => {
    renderSheet({ projectStartDate: "2026-08-10" });

    expect(screen.getByLabelText("Fechas planificadas")).toHaveTextContent(
      /7 ago.*2026/,
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
      "El inicio planificado no puede ser anterior a la fecha de inicio del proyecto.",
    );
  });

  test("keeps cached detail visible and warns when a background refresh fails", () => {
    mocks.taskQuery.isError = true;
    mocks.taskQuery.isRefetchError = true;
    mocks.taskQuery.error = new Error("background refetch failed");
    renderSheet();

    expect(
      screen.getByRole("dialog", { name: "Preparar recurso" }),
    ).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Guardar cambios" }),
    ).toBeEnabled();
    expect(screen.getByRole("status")).toHaveTextContent(
      "Mostramos la última información guardada porque no pudimos actualizarla.",
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Actualizar información" }),
    );
    expect(mocks.taskQuery.refetch).toHaveBeenCalledOnce();
  });

  test("does not show stale detail when the selected task changes", () => {
    const { rerenderSheet } = renderSheet();
    expect(
      screen.getByRole("dialog", { name: "Preparar recurso" }),
    ).toBeVisible();

    rerenderSheet({ taskId: "task-2" });

    expect(
      screen.getByRole("dialog", { name: "Cargando tarea" }),
    ).toBeVisible();
    expect(screen.queryByLabelText("Título")).not.toBeInTheDocument();
    expect(mocks.taskQueryArgs).toMatchObject({
      taskId: "task-2",
      options: { query: { enabled: true } },
    });
  });

  test("shows archived task details read-only and restores into the active form", async () => {
    const archivedTask = {
      ...activeTask,
      archivedAt: "2026-08-07T10:00:00.000Z",
    };
    const restoredTask = {
      ...activeTask,
      updatedAt: "2026-08-07T11:00:00.000Z",
    };
    mocks.taskQuery.data = { task: archivedTask };
    mocks.restore.mockResolvedValue({ task: restoredTask });
    const { onSaved, onOpenChange } = renderSheet();

    expect(
      screen.getByRole("dialog", { name: "Preparar recurso" }),
    ).toBeVisible();
    expect(screen.getByText("Archivada")).toBeInTheDocument();
    expect(screen.getByText("En trabajo")).toBeInTheDocument();
    expect(screen.getByText("Investigación")).toBeInTheDocument();
    expect(
      screen.getByText("Revisar los fundamentos de la apelación."),
    ).toBeInTheDocument();
    expect(screen.getByText("7 ago 2026")).toBeInTheDocument();
    expect(screen.getByText("14 ago 2026")).toBeInTheDocument();
    expect(
      screen.getByRole("link", {
        name: "LR, Luis Ramos, Junior, Encargado",
      }),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText("Título")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Restaurar" }));

    await waitFor(() =>
      expect(mocks.restore).toHaveBeenCalledWith({
        projectId: "project-1",
        taskId: "task-1",
      }),
    );
    expect(onSaved).toHaveBeenCalledOnce();
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
    expect(mocks.taskQuery.refetch).toHaveBeenCalledOnce();
    expect(
      screen.getByRole("button", { name: "Guardar cambios" }),
    ).toBeEnabled();
  });

  test("saves authoritative values, invalidates related data, and stays open", async () => {
    const updatedTask = {
      ...activeTask,
      title: "Preparar recurso final",
      updatedAt: "2026-08-07T11:00:00.000Z",
    };
    const authoritativeTask = {
      ...updatedTask,
      responsibles: [],
      updatedAt: "2026-08-07T11:00:01.000Z",
    };
    mocks.update.mockResolvedValue({ task: updatedTask });
    mocks.replace.mockResolvedValue({ task: authoritativeTask });
    const { invalidate, onSaved, onOpenChange } = renderSheet();

    fireEvent.change(screen.getByLabelText("Título"), {
      target: { value: "Preparar recurso final" },
    });
    fireEvent.click(screen.getByRole("checkbox", { name: /Luis Ramos/ }));
    fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));

    await waitFor(() =>
      expect(mocks.update).toHaveBeenCalledWith({
        projectId: "project-1",
        taskId: "task-1",
        data: {
          title: "Preparar recurso final",
          stageId: "stage-1",
          description: "Revisar los fundamentos de la apelación.",
          status: "in_progress",
          plannedStartDate: "2026-08-07",
          internalDueDate: "2026-08-14",
        },
      }),
    );
    expect(mocks.replace).toHaveBeenCalledWith({
      projectId: "project-1",
      taskId: "task-1",
      data: { responsibleUserIds: [] },
    });
    expect(onSaved).toHaveBeenCalledOnce();
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
    expect(screen.getByRole("dialog")).toBeVisible();
    expect(screen.getByLabelText("Título")).toHaveValue(
      "Preparar recurso final",
    );
    for (const queryKey of [
      ["/api/projects/project-1/tasks"],
      ["/api/projects/project-1/activities"],
      ["/api/projects/project-1/task-schedule"],
    ]) {
      expect(invalidate).toHaveBeenCalledWith({ queryKey });
    }
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: ["/api/projects/project-1/tasks/task-1"],
      refetchType: "none",
    });
  });

  test("keeps the PATCH result and reports a partial save when responsibles fail", async () => {
    const patchedTask = {
      ...activeTask,
      title: "Preparar recurso corregido",
      updatedAt: "2026-08-07T11:00:00.000Z",
    };
    mocks.update.mockResolvedValue({ task: patchedTask });
    mocks.replace.mockRejectedValue({ status: 409 });
    mocks.taskQuery.refetch.mockResolvedValue({ data: { task: patchedTask } });
    const { invalidate, onSaved, queryClient } = renderSheet();

    fireEvent.change(screen.getByLabelText("Título"), {
      target: { value: "Preparar recurso corregido" },
    });
    fireEvent.click(screen.getByRole("checkbox", { name: /Luis Ramos/ }));
    fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Los datos de la tarea se guardaron, pero los cambios en los encargados no se guardaron. Vuelve a seleccionarlos e inténtalo nuevamente.",
    );
    expect(
      screen.queryByText("No pudimos guardar la tarea. Inténtalo nuevamente."),
    ).not.toBeInTheDocument();
    expect(onSaved).toHaveBeenCalledOnce();
    expect(
      queryClient.getQueryData(["/api/projects/project-1/tasks/task-1"]),
    ).toEqual({ task: patchedTask });
    expect(screen.getByLabelText("Título")).toHaveValue(
      "Preparar recurso corregido",
    );
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: ["/api/projects/project-1/tasks/task-1"],
      refetchType: "none",
    });
    for (const queryKey of [
      ["/api/projects/project-1/tasks"],
      ["/api/projects/project-1/activities"],
      ["/api/projects/project-1/task-schedule"],
    ]) {
      expect(invalidate).toHaveBeenCalledWith({ queryKey });
    }
    expect(mocks.taskQuery.refetch).toHaveBeenCalledOnce();
    expect(mocks.assignmentsQuery.refetch).toHaveBeenCalledOnce();
  });

  test("refreshes and shows the current task after an update conflict", async () => {
    const archivedServerTask = {
      ...activeTask,
      title: "Preparar recurso archivado",
      archivedAt: "2026-08-07T12:00:00.000Z",
      updatedAt: "2026-08-07T12:00:00.000Z",
    };
    mocks.update.mockRejectedValue({ status: 409 });
    mocks.taskQuery.refetch.mockResolvedValue(
      await taskRefetchResult(activeTask, async () => ({
        task: archivedServerTask,
      })),
    );
    const { queryClient } = renderSheet();

    fireEvent.change(screen.getByLabelText("Título"), {
      target: { value: "Mi edición desactualizada" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "La tarea cambió mientras la editabas. Mostramos la versión más reciente. Revisa los cambios antes de continuar.",
    );
    expect(mocks.taskQuery.refetch).toHaveBeenCalledWith({
      throwOnError: true,
    });
    expect(mocks.taskQuery.refetch).toHaveBeenCalledOnce();
    expect(
      screen.queryByText("No pudimos guardar la tarea. Inténtalo nuevamente."),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Preparar recurso archivado" }),
    ).toBeVisible();
    expect(screen.getByText("Archivada")).toBeInTheDocument();
    expect(screen.queryByLabelText("Título")).not.toBeInTheDocument();
    expect(
      queryClient.getQueryData(["/api/projects/project-1/tasks/task-1"]),
    ).toEqual({ task: archivedServerTask });
  });

  test("does not cache retained stale data when an update-conflict refetch fails", async () => {
    const protectedCachedTask = {
      ...activeTask,
      title: "Detalle protegido en caché",
    };
    const refreshError = new Error("offline");
    const failedResult = await taskRefetchResult(activeTask, async () => {
      throw refreshError;
    });
    mocks.update.mockRejectedValue({ status: 409 });
    mocks.taskQuery.refetch.mockImplementation(async () => {
      mocks.taskQuery.isError = true;
      mocks.taskQuery.isRefetchError = true;
      mocks.taskQuery.error = refreshError;
      return failedResult;
    });
    const { queryClient } = renderSheet();
    queryClient.setQueryData(["/api/projects/project-1/tasks/task-1"], {
      task: protectedCachedTask,
    });

    fireEvent.change(screen.getByLabelText("Título"), {
      target: { value: "Mi edición desactualizada" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "La tarea cambió mientras la editabas, pero no pudimos cargar la versión más reciente. Usa «Actualizar información» antes de continuar.",
    );
    expect(
      queryClient.getQueryData(["/api/projects/project-1/tasks/task-1"]),
    ).toEqual({ task: protectedCachedTask });
    expect(screen.getByLabelText("Título")).toHaveValue(
      "Mi edición desactualizada",
    );
    expect(
      screen.getByRole("button", { name: "Actualizar información" }),
    ).toBeEnabled();
    expect(mocks.taskQuery.refetch).toHaveBeenCalledOnce();
  });

  test("clears failed-conflict guidance after a manual detail retry succeeds", async () => {
    const refreshError = new Error("offline");
    const failedResult = await taskRefetchResult(activeTask, async () => {
      throw refreshError;
    });
    const refreshedTask = {
      ...activeTask,
      title: "Preparar recurso actualizado por Ana",
      updatedAt: "2026-08-07T13:00:00.000Z",
    };
    const successfulResult = await taskRefetchResult(activeTask, async () => ({
      task: refreshedTask,
    }));
    mocks.update.mockRejectedValue({ status: 409 });
    mocks.taskQuery.refetch
      .mockImplementationOnce(async () => {
        mocks.taskQuery.isError = true;
        mocks.taskQuery.isRefetchError = true;
        mocks.taskQuery.error = refreshError;
        return failedResult;
      })
      .mockImplementationOnce(async () => {
        mocks.taskQuery.data = { task: refreshedTask };
        mocks.taskQuery.isError = false;
        mocks.taskQuery.isRefetchError = false;
        mocks.taskQuery.error = null;
        return successfulResult;
      });
    const { rerenderSheet } = renderSheet();

    fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Usa «Actualizar información» antes de continuar.",
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Actualizar información" }),
    );
    await waitFor(() =>
      expect(mocks.taskQuery.refetch).toHaveBeenCalledTimes(2),
    );
    rerenderSheet();

    await waitFor(() =>
      expect(screen.getByLabelText("Título")).toHaveValue(
        "Preparar recurso actualizado por Ana",
      ),
    );
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Actualizar información" }),
    ).not.toBeInTheDocument();
    expect(mocks.taskQuery.refetch).toHaveBeenNthCalledWith(1, {
      throwOnError: true,
    });
    expect(mocks.taskQuery.refetch).toHaveBeenNthCalledWith(2, {
      throwOnError: true,
    });
  });

  test("reports a successful save even when cache refresh cannot finish", async () => {
    const { invalidate, onSaved } = renderSheet();
    invalidate.mockRejectedValueOnce(new Error("cache refresh failed"));

    fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));

    await waitFor(() => expect(mocks.update).toHaveBeenCalledOnce());
    expect(onSaved).toHaveBeenCalledOnce();
    expect(screen.getByRole("dialog")).toBeVisible();
  });

  test("keeps a successful restore when the authoritative refetch fails", async () => {
    mocks.taskQuery.data = {
      task: { ...activeTask, archivedAt: "2026-08-07T10:00:00.000Z" },
    };
    mocks.taskQuery.refetch.mockRejectedValue(new Error("refetch failed"));
    const { onSaved } = renderSheet();

    fireEvent.click(screen.getByRole("button", { name: "Restaurar" }));

    await waitFor(() => expect(mocks.restore).toHaveBeenCalledOnce());
    expect(onSaved).toHaveBeenCalledOnce();
    expect(
      screen.getByRole("button", { name: "Guardar cambios" }),
    ).toBeEnabled();
  });

  test("shows a contextual error when restore itself fails", async () => {
    mocks.taskQuery.data = {
      task: { ...activeTask, archivedAt: "2026-08-07T10:00:00.000Z" },
    };
    mocks.restore.mockRejectedValue(new Error("restore failed"));
    renderSheet();

    fireEvent.click(screen.getByRole("button", { name: "Restaurar" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "No pudimos restaurar la tarea. Inténtalo nuevamente.",
    );
  });

  test("refreshes and shows the current task after a restore conflict", async () => {
    const archivedTask = {
      ...activeTask,
      archivedAt: "2026-08-07T10:00:00.000Z",
    };
    const restoredServerTask = {
      ...activeTask,
      title: "Preparar recurso restaurado por Ana",
      updatedAt: "2026-08-07T12:00:00.000Z",
    };
    mocks.taskQuery.data = { task: archivedTask };
    mocks.restore.mockRejectedValue({ status: 409 });
    mocks.taskQuery.refetch.mockResolvedValue(
      await taskRefetchResult(archivedTask, async () => ({
        task: restoredServerTask,
      })),
    );
    const { queryClient } = renderSheet();

    fireEvent.click(screen.getByRole("button", { name: "Restaurar" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "La tarea cambió antes de restaurarla. Mostramos la versión más reciente. Revisa su estado antes de continuar.",
    );
    expect(mocks.taskQuery.refetch).toHaveBeenCalledWith({
      throwOnError: true,
    });
    expect(mocks.taskQuery.refetch).toHaveBeenCalledOnce();
    expect(
      screen.queryByText(
        "No pudimos restaurar la tarea. Inténtalo nuevamente.",
      ),
    ).not.toBeInTheDocument();
    expect(screen.getByLabelText("Título")).toHaveValue(
      "Preparar recurso restaurado por Ana",
    );
    expect(
      screen.getByRole("button", { name: "Guardar cambios" }),
    ).toBeEnabled();
    expect(
      queryClient.getQueryData(["/api/projects/project-1/tasks/task-1"]),
    ).toEqual({ task: restoredServerTask });
  });

  test("does not cache retained stale data when a restore-conflict refetch fails", async () => {
    const archivedTask = {
      ...activeTask,
      archivedAt: "2026-08-07T10:00:00.000Z",
    };
    const protectedCachedTask = {
      ...archivedTask,
      title: "Detalle archivado protegido en caché",
    };
    const refreshError = new Error("offline");
    const failedResult = await taskRefetchResult(archivedTask, async () => {
      throw refreshError;
    });
    mocks.taskQuery.data = { task: archivedTask };
    mocks.restore.mockRejectedValue({ status: 409 });
    mocks.taskQuery.refetch.mockImplementation(async () => {
      mocks.taskQuery.isError = true;
      mocks.taskQuery.isRefetchError = true;
      mocks.taskQuery.error = refreshError;
      return failedResult;
    });
    const { queryClient } = renderSheet();
    queryClient.setQueryData(["/api/projects/project-1/tasks/task-1"], {
      task: protectedCachedTask,
    });

    fireEvent.click(screen.getByRole("button", { name: "Restaurar" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "La tarea cambió antes de restaurarla, pero no pudimos cargar la versión más reciente. Usa «Actualizar información» antes de continuar.",
    );
    expect(
      queryClient.getQueryData(["/api/projects/project-1/tasks/task-1"]),
    ).toEqual({ task: protectedCachedTask });
    expect(screen.getByText("Archivada")).toBeInTheDocument();
    expect(screen.queryByLabelText("Título")).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Actualizar información" }),
    ).toBeEnabled();
    expect(mocks.taskQuery.refetch).toHaveBeenCalledOnce();
  });

  test("offers contextual retries for local task and form-data failures", () => {
    mocks.taskQuery.data = undefined;
    mocks.taskQuery.isError = true;
    mocks.taskQuery.error = new Error("failed");
    const { rerenderSheet } = renderSheet();

    expect(screen.getByRole("alert")).toHaveTextContent(
      "No pudimos cargar esta tarea.",
    );
    fireEvent.click(screen.getByRole("button", { name: "Intentar de nuevo" }));
    expect(mocks.taskQuery.refetch).toHaveBeenCalledOnce();

    mocks.taskQuery.data = { task: activeTask };
    mocks.taskQuery.isError = false;
    mocks.stagesQuery.data = undefined;
    mocks.stagesQuery.isError = true;
    rerenderSheet();

    expect(screen.getByRole("alert")).toHaveTextContent(
      "No pudimos cargar los datos para editar esta tarea.",
    );
    fireEvent.click(screen.getByRole("button", { name: "Intentar de nuevo" }));
    expect(mocks.stagesQuery.refetch).toHaveBeenCalledOnce();
    expect(mocks.assignmentsQuery.refetch).toHaveBeenCalledOnce();
  });

  test("lets an unavailable task close without replacing surrounding content", () => {
    const { onOpenChange } = renderSheet({ taskId: null });

    expect(screen.getByText("Tarea no disponible")).toBeInTheDocument();
    expect(screen.getByTestId("surrounding-page")).toHaveTextContent(
      "Contenido del proyecto",
    );
    fireEvent.click(screen.getByRole("button", { name: "Cerrar" }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(screen.getByTestId("surrounding-page")).toBeInTheDocument();
    expect(mocks.taskQueryArgs).toMatchObject({
      taskId: "",
      options: { query: { enabled: false } },
    });
  });

  test("restores focus to the controlled opener after Escape dismissal", async () => {
    const { opener, onOpenChange, rerenderSheet } = renderSheet({
      open: false,
    });
    opener.focus();
    rerenderSheet({ open: true });
    expect(screen.getByRole("dialog")).toBeVisible();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(onOpenChange).toHaveBeenCalledWith(false);
    rerenderSheet({ open: false });

    await waitFor(() => expect(opener).toHaveFocus());
  });

  test("uses compiled-or-static Sheet classes instead of missing animation utilities", () => {
    renderSheet();

    for (const element of document.querySelectorAll(
      '[data-slot="sheet-overlay"], [data-slot="sheet-content"]',
    )) {
      expect(element.className).not.toMatch(
        /animate-|fade-|slide-in-|slide-out-/,
      );
    }
  });

  test("wraps unbroken archived title and description on mobile", () => {
    const title = "T".repeat(160);
    const description = "D".repeat(2000);
    mocks.taskQuery.data = {
      task: {
        ...activeTask,
        title,
        description,
        archivedAt: "2026-08-07T10:00:00.000Z",
      },
    };
    renderSheet();

    expect(screen.getByRole("heading", { name: title })).toHaveClass(
      "[overflow-wrap:anywhere]",
    );
    expect(screen.getByText(description)).toHaveClass(
      "[overflow-wrap:anywhere]",
    );
  });

  test("uses contrast-safe Sheet foreground tokens", () => {
    mocks.taskQuery.data = undefined;
    mocks.taskQuery.isError = true;
    renderSheet();

    expect(screen.getByRole("alert")).toHaveClass(
      "bg-danger-soft",
      "text-danger",
    );
    expect(
      screen.getByText("El resto del proyecto sigue disponible."),
    ).toHaveClass("text-muted-foreground");
    expect(
      contrastRatio(cssColor("--danger"), cssColor("--danger-soft")),
    ).toBeGreaterThanOrEqual(4.5);
    expect(
      contrastRatio(cssColor("--muted-foreground"), cssColor("--background")),
    ).toBeGreaterThanOrEqual(4.5);
  });
});
