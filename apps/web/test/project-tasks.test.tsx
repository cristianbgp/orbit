import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createRef } from "react";
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

import { ProjectTasks } from "@/features/projects/project-tasks";
import type {
  ProjectTask,
  ProjectTaskScheduleResponse,
} from "@/lib/api/generated/models";

const task: ProjectTask = {
  id: "task-1",
  stage: { id: "stage-1", name: "Investigación", position: 0 },
  title: "Revisar antecedentes",
  description: null,
  status: "pending",
  plannedStartDate: null,
  internalDueDate: null,
  position: 0,
  archivedAt: null,
  responsibles: [],
  createdAt: "2026-08-06T20:00:00.000Z",
  updatedAt: "2026-08-06T20:00:00.000Z",
};

const taskTwo: ProjectTask = {
  ...task,
  id: "task-2",
  stage: { id: "stage-2", name: "Informe", position: 1 },
  title: "Preparar informe",
};

const mocks = vi.hoisted(() => ({
  listParams: undefined as unknown,
  taskQuery: {
    data: undefined as
      | undefined
      | {
          tasks: ProjectTask[];
          pagination: {
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
  stagesQuery: {
    data: undefined as
      | undefined
      | {
          stages: Array<{
            id: string;
            name: string;
            description: null;
            position: number;
            createdAt: string;
            updatedAt: string;
          }>;
        },
    isPending: false,
    isError: false,
    refetch: vi.fn(),
  },
  assignmentsQuery: {
    data: undefined as
      | undefined
      | {
          active: never[];
          history: never[];
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
  create: vi.fn(),
  archive: vi.fn(),
  update: vi.fn(),
  sheetProjectStartDate: "",
  sheetReadOnly: false,
  scheduleQuery: {
    data: {
      project: {
        startDate: "2026-08-06",
        endDate: "2026-08-14",
        timeZone: "America/Lima",
      },
      events: [],
      stages: [
        {
          id: "stage-1",
          name: "Investigación",
          position: 0,
          startDate: "2026-08-06",
          endDate: null,
          scheduledTaskCount: 0,
          taskStatusCounts: {
            pending: 1,
            inProgress: 0,
            blocked: 0,
            completed: 0,
          },
          tasks: [
            {
              id: "task-1",
              title: "Revisar antecedentes",
              status: "pending",
              plannedStartDate: null,
              internalDueDate: null,
              position: 0,
            },
          ],
          usesProjectStartFallback: false,
        },
        {
          id: "stage-2",
          name: "Informe",
          position: 1,
          startDate: null,
          endDate: null,
          scheduledTaskCount: 0,
          taskStatusCounts: {
            pending: 1,
            inProgress: 0,
            blocked: 0,
            completed: 0,
          },
          tasks: [
            {
              id: "task-2",
              title: "Preparar informe",
              status: "pending",
              plannedStartDate: null,
              internalDueDate: null,
              position: 0,
            },
          ],
          usesProjectStartFallback: false,
        },
      ],
    },
    isError: false,
    refetch: vi.fn(),
  },
}));

const stagesData = {
  stages: [
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
      name: "Informe",
      description: null,
      position: 1,
      createdAt: "2026-08-06T10:00:00.000Z",
      updatedAt: "2026-08-06T10:00:00.000Z",
    },
  ],
};

const assignmentsData = {
  active: [],
  history: [],
  historyPagination: { page: 1, pageSize: 1, total: 0, totalPages: 0 },
};

vi.mock("@/lib/api/generated/project-tasks/project-tasks", () => ({
  useListProjectTasks: (_projectId: string, params: unknown) => {
    mocks.listParams = params;
    return mocks.taskQuery;
  },
  useGetProjectTaskSchedule: () => mocks.scheduleQuery,
  getGetProjectTaskScheduleQueryKey: (projectId: string) => [
    `/api/projects/${projectId}/task-schedule`,
  ],
  getListProjectTasksQueryKey: (projectId: string) => [
    `/api/projects/${projectId}/tasks`,
  ],
  useCreateProjectTask: () => ({ mutateAsync: mocks.create, isPending: false }),
  useArchiveProjectTask: () => ({
    mutateAsync: mocks.archive,
    isPending: false,
  }),
  useUpdateProjectTask: () => ({
    mutateAsync: mocks.update,
    isPending: false,
  }),
  getListProjectTaskCalendarQueryKey: () => ["/api/project-tasks/calendar"],
  getListUndatedProjectTasksQueryKey: () => ["/api/project-tasks/undated"],
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

vi.mock("@/features/projects/project-task-sheet", () => ({
  ProjectTaskSheet: ({
    taskId,
    open,
    projectStartDate,
    openerRef,
    onOpenChange,
    onSaved,
    readOnly,
  }: {
    taskId: string | null;
    open: boolean;
    projectStartDate: string;
    openerRef: { current: HTMLElement | null };
    onOpenChange(open: boolean): void;
    onSaved(): void;
    readOnly?: boolean;
  }) => {
    mocks.sheetProjectStartDate = projectStartDate;
    mocks.sheetReadOnly = Boolean(readOnly);
    if (!open || !taskId) return null;
    const title =
      taskId === "task-1"
        ? "Revisar antecedentes"
        : taskId === "task-2"
          ? "Preparar informe"
          : taskId === "task-9"
            ? "Task nine"
            : "Tarea no disponible";
    return (
      <div role="dialog" aria-label={title}>
        <button
          type="button"
          onClick={() => {
            onOpenChange(false);
            openerRef.current?.focus();
          }}
        >
          Cerrar
        </button>
        <button type="button" onClick={onSaved}>
          Simular guardado
        </button>
      </div>
    );
  },
}));

function LocationProbe() {
  const location = useLocation();
  return (
    <output data-testid="location">{`${location.pathname}${location.search}`}</output>
  );
}

function HistoryControls() {
  const navigate = useNavigate();
  return (
    <>
      <button type="button" onClick={() => void navigate(-1)}>
        Atrás
      </button>
      <button type="button" onClick={() => void navigate(1)}>
        Adelante
      </button>
    </>
  );
}

function renderTasks(
  initialEntries = ["/projects/project-1"],
  initialIndex = initialEntries.length - 1,
  readOnly = false,
) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const invalidate = vi.spyOn(queryClient, "invalidateQueries");
  const activeTaskKey = [
    "/api/projects/project-1/tasks",
    { view: "active", page: 1, pageSize: 25 },
  ] as const;
  if (mocks.taskQuery.data) {
    queryClient.setQueryData(activeTaskKey, mocks.taskQuery.data);
  }
  const scheduleKey = ["/api/projects/project-1/task-schedule"] as const;
  queryClient.setQueryData(scheduleKey, mocks.scheduleQuery.data);
  const taskOpenerRef = createRef<HTMLElement>();
  const renderResult = render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={initialEntries} initialIndex={initialIndex}>
        <ProjectTasks
          projectStatus="active"
          projectId="project-1"
          projectStartDate="2026-08-06"
          taskOpenerRef={taskOpenerRef}
          readOnly={readOnly}
        />
        <LocationProbe />
        <HistoryControls />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return {
    invalidate,
    taskOpenerRef,
    queryClient,
    activeTaskKey,
    scheduleKey,
    ...renderResult,
  };
}

function timelineStatusTrigger(title: string, stageName = "Investigación") {
  return within(
    screen.getByRole("group", { name: `Tareas de ${stageName}` }),
  ).getByRole("combobox", {
    name: new RegExp(`Cambiar estado de ${title}`),
  });
}

function useDesktopViewport() {
  vi.stubGlobal(
    "ResizeObserver",
    class ResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  vi.stubGlobal(
    "matchMedia",
    vi.fn((query: string) => ({
      matches: query === "(min-width: 768px)",
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  );
}

describe("ProjectTasks", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  beforeEach(() => {
    mocks.taskQuery.data = {
      tasks: [task],
      pagination: { page: 1, pageSize: 25, total: 1, totalPages: 1 },
    };
    mocks.taskQuery.isPending = false;
    mocks.taskQuery.isError = false;
    mocks.taskQuery.refetch.mockReset().mockResolvedValue(undefined);
    mocks.stagesQuery.data = stagesData;
    mocks.stagesQuery.isPending = false;
    mocks.stagesQuery.isError = false;
    mocks.stagesQuery.refetch.mockReset().mockResolvedValue(undefined);
    mocks.assignmentsQuery.data = assignmentsData;
    mocks.assignmentsQuery.isPending = false;
    mocks.assignmentsQuery.isError = false;
    mocks.assignmentsQuery.refetch.mockReset().mockResolvedValue(undefined);
    mocks.create.mockReset().mockResolvedValue({ task });
    mocks.sheetProjectStartDate = "";
    mocks.sheetReadOnly = false;
    mocks.archive.mockReset().mockResolvedValue({
      task: { ...task, archivedAt: "2026-08-07T10:00:00.000Z" },
    });
    mocks.update.mockReset().mockResolvedValue({ task });
    mocks.scheduleQuery.data.stages[0].taskStatusCounts = {
      pending: 1,
      inProgress: 0,
      blocked: 0,
      completed: 0,
    };
    mocks.scheduleQuery.data.stages[0].tasks[0].status = "pending";
    mocks.scheduleQuery.data.stages[1].taskStatusCounts = {
      pending: 1,
      inProgress: 0,
      blocked: 0,
      completed: 0,
    };
    mocks.scheduleQuery.data.stages[1].tasks[0].status = "pending";
  });

  test("renders the task board before the timeline", () => {
    renderTasks();

    const tasksHeading = screen.getByRole("heading", { name: "Tareas" });
    const timelineHeading = screen.getByRole("heading", {
      name: "Cronograma",
    });

    expect(
      tasksHeading.compareDocumentPosition(timelineHeading) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  test("uses separate active and archived server views", () => {
    renderTasks();
    expect(mocks.listParams).toEqual({ view: "active", page: 1, pageSize: 25 });
    fireEvent.click(screen.getByRole("tab", { name: "Archivadas" }));
    expect(mocks.listParams).toEqual({
      view: "archived",
      page: 1,
      pageSize: 25,
    });
  });

  test("keeps archived project tasks readable without mutation controls", () => {
    renderTasks(["/projects/project-1"], 0, true);
    expect(screen.getAllByText("Revisar antecedentes").length).toBeGreaterThan(
      0,
    );
    expect(
      screen.queryByRole("button", { name: "Nueva tarea" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Archivar Revisar antecedentes/ }),
    ).not.toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", {
        name: /Ver detalles de Revisar antecedentes/,
      }),
    );
    expect(mocks.sheetReadOnly).toBe(true);
  });

  test("creates a task and refreshes tasks and activity", async () => {
    const { invalidate } = renderTasks();
    fireEvent.click(screen.getByRole("button", { name: "Nueva tarea" }));
    fireEvent.click(screen.getByLabelText("Fechas planificadas"));
    expect(
      screen.getByRole("button", {
        name: /^miércoles, 5 de agosto de 2026$/i,
      }),
    ).toBeDisabled();
    fireEvent.click(screen.getByLabelText("Fechas planificadas"));
    fireEvent.change(screen.getByLabelText("Título"), {
      target: { value: "Preparar informe" },
    });
    fireEvent.keyDown(screen.getByLabelText("Título"), { key: "Enter" });

    await waitFor(() =>
      expect(mocks.create).toHaveBeenCalledWith({
        projectId: "project-1",
        data: {
          title: "Preparar informe",
          stageId: "stage-1",
          description: null,
          status: "pending",
          plannedStartDate: null,
          internalDueDate: null,
          responsibleUserIds: [],
        },
      }),
    );
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: ["/api/projects/project-1/tasks"],
    });
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: ["/api/projects/project-1/activities"],
    });
    expect(mocks.sheetProjectStartDate).toBe("2026-08-06");
  });

  test("optimistically changes one status and reconciles automatic dates", async () => {
    let resolveUpdate!: (value: { task: ProjectTask }) => void;
    mocks.update.mockReturnValue(
      new Promise<{ task: ProjectTask }>((resolve) => {
        resolveUpdate = resolve;
      }),
    );
    const { queryClient, activeTaskKey, scheduleKey, invalidate } =
      renderTasks();

    const stageTasks = screen.getByRole("group", {
      name: "Tareas de Investigación",
    });
    const trigger = within(stageTasks).getByRole("combobox", {
      name: /Cambiar estado de Revisar antecedentes/,
    });
    fireEvent.keyDown(trigger, { key: "ArrowDown" });
    fireEvent.click(screen.getByRole("option", { name: "En trabajo" }));

    await waitFor(() =>
      expect(mocks.update).toHaveBeenCalledWith({
        projectId: "project-1",
        taskId: "task-1",
        data: { status: "in_progress" },
      }),
    );
    expect(
      queryClient.getQueryData<{ tasks: ProjectTask[] }>(activeTaskKey)
        ?.tasks[0]?.status,
    ).toBe("in_progress");
    const optimisticSchedule =
      queryClient.getQueryData<ProjectTaskScheduleResponse>(scheduleKey);
    expect(optimisticSchedule?.stages[0].tasks[0].status).toBe("in_progress");
    expect(optimisticSchedule?.stages[0].taskStatusCounts).toEqual({
      pending: 0,
      inProgress: 1,
      blocked: 0,
      completed: 0,
    });
    expect(trigger).toBeDisabled();

    const authoritativeTask = {
      ...task,
      status: "in_progress" as const,
      plannedStartDate: "2026-08-11",
    };
    await act(async () => resolveUpdate({ task: authoritativeTask }));

    await waitFor(() =>
      expect(
        queryClient.getQueryData<{ tasks: ProjectTask[] }>(activeTaskKey)
          ?.tasks[0]?.plannedStartDate,
      ).toBe("2026-08-11"),
    );
    expect(trigger).toBeEnabled();
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: ["/api/project-tasks/calendar"],
    });
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: ["/api/project-tasks/undated"],
    });
  });

  test("updates timeline dates and refreshes every task projection", async () => {
    useDesktopViewport();
    const datedTask = {
      ...task,
      plannedStartDate: "2026-08-08",
      internalDueDate: "2026-08-12",
    };
    mocks.taskQuery.data = {
      tasks: [datedTask],
      pagination: { page: 1, pageSize: 25, total: 1, totalPages: 1 },
    };
    Object.assign(mocks.scheduleQuery.data.stages[0].tasks[0], {
      plannedStartDate: datedTask.plannedStartDate,
      internalDueDate: datedTask.internalDueDate,
    });
    mocks.update.mockResolvedValue({
      task: { ...datedTask, internalDueDate: "2026-08-13" },
    });
    const { invalidate } = renderTasks();

    const endHandle = screen.getByRole("button", {
      name: "Cambiar fecha límite de Revisar antecedentes",
    });
    fireEvent.keyDown(endHandle, { key: "ArrowRight" });
    fireEvent.keyDown(endHandle, { key: "Enter" });

    await waitFor(() =>
      expect(mocks.update).toHaveBeenCalledWith({
        projectId: "project-1",
        taskId: "task-1",
        data: {
          plannedStartDate: "2026-08-08",
          internalDueDate: "2026-08-13",
        },
      }),
    );
    for (const queryKey of [
      ["/api/projects/project-1/tasks"],
      ["/api/projects/project-1/activities"],
      ["/api/projects/project-1/task-schedule"],
      ["/api/project-tasks/calendar"],
      ["/api/project-tasks/undated"],
    ]) {
      expect(invalidate).toHaveBeenCalledWith({ queryKey });
    }
  });

  test("restores authoritative task dates after a timeline conflict", async () => {
    useDesktopViewport();
    const datedTask = {
      ...task,
      plannedStartDate: "2026-08-08",
      internalDueDate: "2026-08-12",
    };
    mocks.taskQuery.data = {
      tasks: [datedTask],
      pagination: { page: 1, pageSize: 25, total: 1, totalPages: 1 },
    };
    Object.assign(mocks.scheduleQuery.data.stages[0].tasks[0], {
      plannedStartDate: datedTask.plannedStartDate,
      internalDueDate: datedTask.internalDueDate,
    });
    mocks.update.mockRejectedValue({ status: 409 });
    const { invalidate } = renderTasks();

    const endHandle = screen.getByRole("button", {
      name: "Cambiar fecha límite de Revisar antecedentes",
    });
    fireEvent.keyDown(endHandle, { key: "ArrowRight" });
    fireEvent.keyDown(endHandle, { key: "Enter" });

    expect(
      await screen.findByText(
        "La tarea cambió mientras la editabas. Actualizamos la información; revisa e inténtalo nuevamente.",
      ),
    ).toBeVisible();
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: ["/api/projects/project-1/task-schedule"],
    });
  });

  test("allows independent task status changes while another task is saving", async () => {
    mocks.taskQuery.data = {
      tasks: [task, taskTwo],
      pagination: { page: 1, pageSize: 25, total: 2, totalPages: 1 },
    };
    mocks.update.mockReturnValue(new Promise(() => undefined));
    renderTasks();

    const first = timelineStatusTrigger("Revisar antecedentes");
    fireEvent.keyDown(first, { key: "ArrowDown" });
    fireEvent.click(screen.getByRole("option", { name: "En trabajo" }));
    await waitFor(() => expect(mocks.update).toHaveBeenCalledTimes(1));

    const second = timelineStatusTrigger("Preparar informe", "Informe");
    expect(second).toBeEnabled();
    fireEvent.keyDown(second, { key: "ArrowDown" });
    fireEvent.click(screen.getByRole("option", { name: "Completada" }));

    await waitFor(() => expect(mocks.update).toHaveBeenCalledTimes(2));
    expect(first).toBeDisabled();
    expect(second).toBeDisabled();
  });

  test("rolls back a failed status change and reports the error", async () => {
    mocks.update.mockRejectedValue(new Error("offline"));
    const { queryClient, activeTaskKey, scheduleKey } = renderTasks();

    const trigger = timelineStatusTrigger("Revisar antecedentes");
    fireEvent.keyDown(trigger, { key: "ArrowDown" });
    fireEvent.click(screen.getByRole("option", { name: "Completada" }));

    expect(
      await screen.findByText(
        "No pudimos cambiar el estado de la tarea. Inténtalo nuevamente.",
      ),
    ).toBeVisible();
    expect(
      queryClient.getQueryData<{ tasks: ProjectTask[] }>(activeTaskKey)
        ?.tasks[0]?.status,
    ).toBe("pending");
    expect(
      queryClient.getQueryData<ProjectTaskScheduleResponse>(scheduleKey)
        ?.stages[0].tasks[0].status,
    ).toBe("pending");
    expect(trigger).toBeEnabled();

    const timeline = screen.getByRole("heading", { name: "Cronograma" });
    const alert = screen.getByText(
      "No pudimos cambiar el estado de la tarea. Inténtalo nuevamente.",
    );
    const tasksHeading = screen.getByRole("heading", { name: "Tareas" });
    expect(
      alert.compareDocumentPosition(tasksHeading) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      tasksHeading.compareDocumentPosition(timeline) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  test("rolls the schedule back to its own previous status when list data is stale", async () => {
    mocks.scheduleQuery.data.stages[0].tasks[0].status = "in_progress";
    mocks.scheduleQuery.data.stages[0].taskStatusCounts = {
      pending: 0,
      inProgress: 1,
      blocked: 0,
      completed: 0,
    };
    mocks.update.mockRejectedValue(new Error("offline"));
    const { queryClient, scheduleKey } = renderTasks();

    const trigger = timelineStatusTrigger("Revisar antecedentes");
    fireEvent.keyDown(trigger, { key: "ArrowDown" });
    fireEvent.click(screen.getByRole("option", { name: "Completada" }));

    await screen.findByRole("alert");
    expect(
      queryClient.getQueryData<ProjectTaskScheduleResponse>(scheduleKey)
        ?.stages[0],
    ).toMatchObject({
      taskStatusCounts: {
        pending: 0,
        inProgress: 1,
        blocked: 0,
        completed: 0,
      },
      tasks: [expect.objectContaining({ status: "in_progress" })],
    });
  });

  test("rolls back only the failed schedule task during concurrent updates", async () => {
    mocks.taskQuery.data = {
      tasks: [task, taskTwo],
      pagination: { page: 1, pageSize: 25, total: 2, totalPages: 1 },
    };
    let rejectFirst!: (reason: unknown) => void;
    let resolveSecond!: (value: { task: ProjectTask }) => void;
    mocks.update.mockImplementation(
      ({ taskId }: { taskId: string }) =>
        new Promise((resolve, reject) => {
          if (taskId === "task-1") rejectFirst = reject;
          else resolveSecond = resolve;
        }),
    );
    const { queryClient, scheduleKey } = renderTasks();

    const first = timelineStatusTrigger("Revisar antecedentes");
    fireEvent.keyDown(first, { key: "ArrowDown" });
    fireEvent.click(screen.getByRole("option", { name: "En trabajo" }));

    const second = timelineStatusTrigger("Preparar informe", "Informe");
    fireEvent.keyDown(second, { key: "ArrowDown" });
    fireEvent.click(screen.getByRole("option", { name: "Completada" }));
    await waitFor(() => expect(mocks.update).toHaveBeenCalledTimes(2));

    await act(async () =>
      resolveSecond({ task: { ...taskTwo, status: "completed" } }),
    );
    await act(async () => rejectFirst(new Error("offline")));

    await waitFor(() =>
      expect(
        queryClient
          .getQueryData<ProjectTaskScheduleResponse>(scheduleKey)
          ?.stages.flatMap((stage) => stage.tasks)
          .map(({ id, status }) => [id, status]),
      ).toEqual([
        ["task-1", "pending"],
        ["task-2", "completed"],
      ]),
    );
  });

  test("refreshes authoritative data after a status conflict", async () => {
    mocks.update.mockRejectedValue({ status: 409 });
    renderTasks();

    const trigger = timelineStatusTrigger("Revisar antecedentes");
    fireEvent.keyDown(trigger, { key: "ArrowDown" });
    fireEvent.click(screen.getByRole("option", { name: "Suspendida" }));

    expect(
      await screen.findByText(
        "La tarea cambió mientras actualizabas su estado. Revisa la información e inténtalo nuevamente.",
      ),
    ).toBeVisible();
    expect(mocks.taskQuery.refetch).toHaveBeenCalledOnce();
  });

  test("re-enables the selector when a background refresh fails", async () => {
    const { invalidate } = renderTasks();
    invalidate.mockRejectedValue(new Error("refresh failed"));

    const trigger = timelineStatusTrigger("Revisar antecedentes");
    fireEvent.keyDown(trigger, { key: "ArrowDown" });
    fireEvent.click(screen.getByRole("option", { name: "En trabajo" }));

    await waitFor(() => expect(mocks.update).toHaveBeenCalledOnce());
    await waitFor(() => expect(trigger).toBeEnabled());
  });

  test("shows timeline and creates directly inside a stage column", () => {
    renderTasks();

    expect(
      screen.getByRole("heading", { name: "Cronograma" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Informe" }),
    ).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: "Nueva tarea en Informe" }),
    );
    expect(screen.getByLabelText("Etapa")).toHaveTextContent("Informe");
  });

  test("opens an expanded timeline task without discarding project filters", () => {
    const { taskOpenerRef } = renderTasks([
      "/projects/project-1?view=active&filter=mine",
    ]);

    const taskButton = screen.getByRole("button", {
      name: "Abrir tarea Revisar antecedentes",
    });
    fireEvent.click(taskButton);

    expect(screen.getByTestId("location")).toHaveTextContent(
      "/projects/project-1?view=active&filter=mine&task=task-1",
    );
    expect(taskOpenerRef.current).toBe(taskButton);
    expect(
      screen.getByRole("dialog", { name: "Revisar antecedentes" }),
    ).toBeVisible();
  });

  test("selects a board task in the URL and restores focus on close", async () => {
    const { taskOpenerRef } = renderTasks([
      "/projects/project-1?view=active&filter=mine",
    ]);
    const edit = screen.getByRole("button", { name: "Editar" });

    fireEvent.click(edit);

    expect(screen.getByTestId("location")).toHaveTextContent(
      "/projects/project-1?view=active&filter=mine&task=task-1",
    );
    expect(
      screen.getByRole("dialog", { name: "Revisar antecedentes" }),
    ).toBeVisible();
    expect(taskOpenerRef.current).toBe(edit);

    fireEvent.click(screen.getByRole("button", { name: "Cerrar" }));
    expect(screen.getByTestId("location")).toHaveTextContent(
      "/projects/project-1?view=active&filter=mine",
    );
    await waitFor(() => expect(edit).toHaveFocus());
  });

  test("uses history entries for task selection and explicit close", () => {
    renderTasks(["/projects/project-1?view=active"]);
    fireEvent.click(screen.getByRole("button", { name: "Editar" }));
    expect(screen.getByRole("dialog")).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "Atrás" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Adelante" }));
    expect(screen.getByRole("dialog")).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "Cerrar" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Atrás" }));
    expect(screen.getByRole("dialog")).toBeVisible();
  });

  test("opens direct, off-page, and stale task IDs independently of the list", () => {
    mocks.taskQuery.data = {
      tasks: [],
      pagination: { page: 3, pageSize: 25, total: 60, totalPages: 3 },
    };
    const { unmount } = renderTasks([
      "/projects/project-1?view=active&task=task-9",
    ]);

    expect(screen.getByRole("dialog", { name: "Task nine" })).toBeVisible();
    unmount();

    renderTasks(["/projects/project-1?view=active&task=stale-task"]);
    expect(
      screen.getByRole("dialog", { name: "Tarea no disponible" }),
    ).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Cerrar" }));
    expect(screen.getByTestId("location")).toHaveTextContent(
      "/projects/project-1?view=active",
    );
  });

  test("opens a direct task while the paginated task list is still loading", () => {
    mocks.taskQuery.data = undefined;
    mocks.taskQuery.isPending = true;

    renderTasks(["/projects/project-1?task=task-9"]);

    expect(screen.getByLabelText("Cargando tareas")).toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: "Task nine" })).toBeVisible();
  });

  test("opens a task from a non-selected mobile stage", () => {
    mocks.taskQuery.data = {
      tasks: [task, taskTwo],
      pagination: { page: 1, pageSize: 25, total: 2, totalPages: 1 },
    };
    renderTasks(["/projects/project-1?task=task-2"]);

    expect(
      screen.getByRole("tab", { name: /Investigación.*1/ }),
    ).toHaveAttribute("aria-selected", "true");
    expect(
      screen.getByRole("dialog", { name: "Preparar informe" }),
    ).toBeVisible();
  });

  test("requires confirmation before archiving and opens archived tasks in the sheet", async () => {
    renderTasks();
    fireEvent.click(
      screen.getByRole("button", { name: "Archivar Revisar antecedentes" }),
    );
    expect(screen.getByText(/permanecerá en el historial/)).toBeInTheDocument();
    expect(mocks.archive).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Confirmar archivo" }));
    await waitFor(() =>
      expect(mocks.archive).toHaveBeenCalledWith({
        projectId: "project-1",
        taskId: "task-1",
      }),
    );

    mocks.taskQuery.data = {
      tasks: [{ ...task, archivedAt: "2026-08-07T10:00:00.000Z" }],
      pagination: { page: 1, pageSize: 25, total: 1, totalPages: 1 },
    };
    fireEvent.click(screen.getByRole("tab", { name: "Archivadas" }));
    fireEvent.click(
      screen.getByRole("button", {
        name: "Ver detalles de Revisar antecedentes",
      }),
    );
    expect(screen.getByTestId("location")).toHaveTextContent(
      "/projects/project-1?task=task-1",
    );
    expect(
      screen.getByRole("dialog", { name: "Revisar antecedentes" }),
    ).toBeVisible();
  });

  test("keeps the project page and offers a local retry on query failure", () => {
    mocks.taskQuery.data = undefined;
    mocks.taskQuery.isError = true;
    renderTasks();
    expect(
      screen.getByText("No pudimos cargar las tareas."),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Intentar de nuevo" }));
    expect(mocks.taskQuery.refetch).toHaveBeenCalledOnce();
  });

  test("returns to the first active page after archiving", async () => {
    mocks.taskQuery.data = {
      tasks: [task],
      pagination: { page: 1, pageSize: 25, total: 26, totalPages: 2 },
    };
    renderTasks();
    fireEvent.click(screen.getByRole("button", { name: "Siguiente" }));
    expect(mocks.listParams).toEqual({ view: "active", page: 2, pageSize: 25 });

    fireEvent.click(
      screen.getByRole("button", { name: "Archivar Revisar antecedentes" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Confirmar archivo" }));

    await waitFor(() =>
      expect(mocks.listParams).toEqual({
        view: "active",
        page: 1,
        pageSize: 25,
      }),
    );
  });

  test("returns to the first archived page after restoring", async () => {
    mocks.taskQuery.data = {
      tasks: [{ ...task, archivedAt: "2026-08-07T10:00:00.000Z" }],
      pagination: { page: 1, pageSize: 25, total: 26, totalPages: 2 },
    };
    renderTasks();
    fireEvent.click(screen.getByRole("tab", { name: "Archivadas" }));
    fireEvent.click(screen.getByRole("button", { name: "Siguiente" }));
    expect(mocks.listParams).toEqual({
      view: "archived",
      page: 2,
      pageSize: 25,
    });

    fireEvent.click(
      screen.getByRole("button", {
        name: "Ver detalles de Revisar antecedentes",
      }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Simular guardado" }));

    await waitFor(() =>
      expect(mocks.listParams).toEqual({
        view: "archived",
        page: 1,
        pageSize: 25,
      }),
    );
  });

  test("offers local retries when task form data fails", () => {
    mocks.stagesQuery.data = undefined;
    mocks.stagesQuery.isError = true;
    mocks.assignmentsQuery.data = undefined;
    mocks.assignmentsQuery.isError = true;
    renderTasks();

    expect(
      screen.getByText("No pudimos cargar las etapas."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("No pudimos cargar el equipo del proyecto."),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Reintentar etapas" }));
    fireEvent.click(screen.getByRole("button", { name: "Reintentar equipo" }));
    expect(mocks.stagesQuery.refetch).toHaveBeenCalledOnce();
    expect(mocks.assignmentsQuery.refetch).toHaveBeenCalledOnce();
  });
});
