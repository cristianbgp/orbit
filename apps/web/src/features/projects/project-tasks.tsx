import { useState, type RefObject } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { getListProjectActivitiesQueryKey } from "@/lib/api/generated/activity/activity";
import { useListProjectAssignments } from "@/lib/api/generated/project-collaboration/project-collaboration";
import { useListProjectStages } from "@/lib/api/generated/project-stages/project-stages";
import {
  getGetProjectTaskScheduleQueryKey,
  getListProjectTaskCalendarQueryKey,
  getListProjectTasksQueryKey,
  getListUndatedProjectTasksQueryKey,
  useArchiveProjectTask,
  useCreateProjectTask,
  useGetProjectTaskSchedule,
  useListProjectTasks,
  useUpdateProjectTask,
} from "@/lib/api/generated/project-tasks/project-tasks";
import type {
  ProjectTask,
  ProjectTaskListResponse,
  ProjectTaskScheduleResponse,
  ProjectTaskStatus,
  ProjectStatus,
} from "@/lib/api/generated/models";
import {
  ProjectTaskForm,
  type ProjectTaskFormInput,
} from "./project-task-form";
import { ProjectTaskBoard } from "./project-task-board";
import { ProjectTaskList } from "./project-task-list";
import { ProjectTaskSheet } from "./project-task-sheet";
import { updateTaskStatusInSchedule } from "./project-task-status-cache";
import { ProjectTaskTimeline } from "./project-task-timeline";
import type { TimelineTaskDateRange } from "./project-task-timeline-resize";

type TaskView = "active" | "archived";

function updateTaskInList(
  data: ProjectTaskListResponse | undefined,
  taskId: string,
  update: (task: ProjectTask) => ProjectTask,
) {
  if (!data) return data;
  return {
    ...data,
    tasks: data.tasks.map((task) => (task.id === taskId ? update(task) : task)),
  };
}

function errorStatus(error: unknown) {
  if (typeof error !== "object" || error === null || !("status" in error)) {
    return undefined;
  }
  return (error as { status?: number }).status;
}

export function ProjectTasks({
  projectId,
  projectStartDate,
  projectStatus,
  taskOpenerRef,
  readOnly = false,
}: {
  projectId: string;
  projectStartDate: string;
  projectStatus: ProjectStatus;
  taskOpenerRef: RefObject<HTMLElement | null>;
  readOnly?: boolean;
}) {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedTaskId = searchParams.get("task");
  const [view, setView] = useState<TaskView>("active");
  const [pages, setPages] = useState<Record<TaskView, number>>({
    active: 1,
    archived: 1,
  });
  const [editor, setEditor] = useState<"closed" | "creating">("closed");
  const [createStageId, setCreateStageId] = useState<string | undefined>();
  const [archiveTarget, setArchiveTarget] = useState<ProjectTask | null>(null);
  const [mutationError, setMutationError] = useState<string | null>(null);
  const [updatingTaskIds, setUpdatingTaskIds] = useState<Set<string>>(
    () => new Set(),
  );
  const page = pages[view];
  const taskQuery = useListProjectTasks(projectId, {
    view,
    page,
    pageSize: 25,
  });
  const stagesQuery = useListProjectStages(projectId);
  const scheduleQuery = useGetProjectTaskSchedule(projectId);
  const assignmentsQuery = useListProjectAssignments(projectId, {
    historyPage: 1,
    historyPageSize: 1,
  });
  const createMutation = useCreateProjectTask();
  const archiveMutation = useArchiveProjectTask();
  const updateMutation = useUpdateProjectTask();
  const busy = createMutation.isPending || archiveMutation.isPending;

  async function refresh() {
    await Promise.allSettled([
      queryClient.invalidateQueries({
        queryKey: getListProjectTasksQueryKey(projectId),
      }),
      queryClient.invalidateQueries({
        queryKey: getListProjectActivitiesQueryKey(projectId),
      }),
      queryClient.invalidateQueries({
        queryKey: getGetProjectTaskScheduleQueryKey(projectId),
      }),
      queryClient.invalidateQueries({
        queryKey: getListProjectTaskCalendarQueryKey(),
      }),
      queryClient.invalidateQueries({
        queryKey: getListUndatedProjectTasksQueryKey(),
      }),
    ]);
  }

  async function changeTaskStatus(
    task: { id: string; status: ProjectTaskStatus },
    status: ProjectTaskStatus,
  ) {
    if (task.status === status || updatingTaskIds.has(task.id)) return;
    const listQueryKey = getListProjectTasksQueryKey(projectId);
    const scheduleQueryKey = getGetProjectTaskScheduleQueryKey(projectId);
    setMutationError(null);
    setUpdatingTaskIds((current) => new Set(current).add(task.id));
    await Promise.all([
      queryClient.cancelQueries({ queryKey: listQueryKey }),
      queryClient.cancelQueries({ queryKey: scheduleQueryKey }),
    ]);
    const snapshots = queryClient.getQueriesData<ProjectTaskListResponse>({
      queryKey: listQueryKey,
    });
    const scheduleSnapshot =
      queryClient.getQueryData<ProjectTaskScheduleResponse>(scheduleQueryKey);
    const previousScheduleStatus = scheduleSnapshot?.stages
      .flatMap((stage) => stage.tasks)
      .find(({ id }) => id === task.id)?.status;
    queryClient.setQueriesData<ProjectTaskListResponse>(
      { queryKey: listQueryKey },
      (data) =>
        updateTaskInList(data, task.id, (cachedTask) => ({
          ...cachedTask,
          status,
        })),
    );
    queryClient.setQueryData<ProjectTaskScheduleResponse>(
      scheduleQueryKey,
      (data) =>
        data ? updateTaskStatusInSchedule(data, task.id, status) : data,
    );

    try {
      const result = await updateMutation.mutateAsync({
        projectId,
        taskId: task.id,
        data: { status },
      });
      queryClient.setQueriesData<ProjectTaskListResponse>(
        { queryKey: listQueryKey },
        (data) => updateTaskInList(data, task.id, () => result.task),
      );
      queryClient.setQueryData<ProjectTaskScheduleResponse>(
        scheduleQueryKey,
        (data) =>
          data
            ? updateTaskStatusInSchedule(data, task.id, result.task.status)
            : data,
      );
    } catch (error) {
      for (const [queryKey, snapshot] of snapshots) {
        const previousTask = snapshot?.tasks.find(({ id }) => id === task.id);
        if (!previousTask) continue;
        queryClient.setQueryData<ProjectTaskListResponse>(queryKey, (current) =>
          updateTaskInList(current ?? snapshot, task.id, () => previousTask),
        );
      }
      if (scheduleSnapshot && previousScheduleStatus) {
        queryClient.setQueryData<ProjectTaskScheduleResponse>(
          scheduleQueryKey,
          (current) =>
            current
              ? updateTaskStatusInSchedule(
                  current,
                  task.id,
                  previousScheduleStatus,
                )
              : scheduleSnapshot,
        );
      }
      if (errorStatus(error) === 409) {
        await taskQuery.refetch();
        setMutationError(
          "La tarea cambió mientras actualizabas su estado. Revisa la información e inténtalo nuevamente.",
        );
      } else {
        setMutationError(
          "No pudimos cambiar el estado de la tarea. Inténtalo nuevamente.",
        );
      }
    } finally {
      await refresh();
      setUpdatingTaskIds((current) => {
        const next = new Set(current);
        next.delete(task.id);
        return next;
      });
    }
  }

  async function changeTaskDates(
    task: {
      id: string;
      plannedStartDate: string | null;
      internalDueDate: string | null;
    },
    range: TimelineTaskDateRange,
  ) {
    if (
      updatingTaskIds.has(task.id) ||
      (task.plannedStartDate === range.plannedStartDate &&
        task.internalDueDate === range.internalDueDate)
    ) {
      return false;
    }
    setMutationError(null);
    setUpdatingTaskIds((current) => new Set(current).add(task.id));
    let saved = false;
    try {
      await updateMutation.mutateAsync({
        projectId,
        taskId: task.id,
        data: range,
      });
      saved = true;
    } catch (error) {
      setMutationError(
        errorStatus(error) === 409
          ? "La tarea cambió mientras la editabas. Actualizamos la información; revisa e inténtalo nuevamente."
          : "No pudimos actualizar la tarea. Inténtalo nuevamente.",
      );
    } finally {
      await refresh();
      setUpdatingTaskIds((current) => {
        const next = new Set(current);
        next.delete(task.id);
        return next;
      });
    }
    return saved;
  }

  async function recover(error: unknown) {
    setMutationError(
      errorStatus(error) === 409
        ? "La tarea cambió mientras la editabas. Actualizamos la información; revisa e inténtalo nuevamente."
        : "No pudimos actualizar la tarea. Inténtalo nuevamente.",
    );
    if (errorStatus(error) === 409) await refresh();
  }

  function openCreate(stageId?: string) {
    setMutationError(null);
    setCreateStageId(stageId);
    setEditor("creating");
  }

  function selectTask(task: { id: string }) {
    setMutationError(null);
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      next.set("task", task.id);
      return next;
    });
  }

  function closeTask() {
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      next.delete("task");
      return next;
    });
  }

  function closeEditor() {
    setEditor("closed");
    setCreateStageId(undefined);
  }

  async function saveTask(input: ProjectTaskFormInput) {
    setMutationError(null);
    try {
      await createMutation.mutateAsync({ projectId, data: input });
      closeEditor();
      await refresh();
    } catch (error) {
      await recover(error);
      throw error;
    }
  }

  async function confirmArchive() {
    if (!archiveTarget) return;
    setMutationError(null);
    try {
      await archiveMutation.mutateAsync({
        projectId,
        taskId: archiveTarget.id,
      });
      setArchiveTarget(null);
      setPages((current) => ({ ...current, active: 1 }));
      await refresh();
    } catch (error) {
      await recover(error);
    }
  }

  function handleTaskSaved() {
    setPages({ active: 1, archived: 1 });
  }

  const taskSheet = (
    <ProjectTaskSheet
      projectId={projectId}
      projectStartDate={projectStartDate}
      taskId={selectedTaskId}
      open={selectedTaskId !== null}
      openerRef={taskOpenerRef}
      onOpenChange={(open) => {
        if (!open) closeTask();
      }}
      onSaved={handleTaskSaved}
      readOnly={readOnly}
    />
  );

  if (taskQuery.isPending) {
    return (
      <>
        <section
          aria-label="Cargando tareas"
          className="rounded-card border-border bg-muted h-64 animate-pulse border"
        />
        {taskSheet}
      </>
    );
  }

  if (taskQuery.isError || !taskQuery.data) {
    return (
      <>
        <section className="rounded-card border-danger/25 bg-card border p-5 sm:p-6">
          <h2 className="font-display text-lg font-semibold">Tareas</h2>
          <p className="text-danger mt-2 text-sm">
            No pudimos cargar las tareas.
          </p>
          <Button
            className="mt-4"
            variant="outline"
            size="sm"
            onClick={() => void taskQuery.refetch()}
          >
            Intentar de nuevo
          </Button>
        </section>
        {taskSheet}
      </>
    );
  }

  const formUnavailable =
    stagesQuery.isPending ||
    assignmentsQuery.isPending ||
    stagesQuery.isError ||
    assignmentsQuery.isError ||
    !stagesQuery.data ||
    !assignmentsQuery.data;
  const totalPages = taskQuery.data.pagination.totalPages;
  const stageTaskStatusCounts = scheduleQuery.data
    ? Object.fromEntries(
        scheduleQuery.data.stages.map((stage) => [
          stage.id,
          stage.taskStatusCounts,
        ]),
      )
    : undefined;

  return (
    <>
      {mutationError ? (
        <p
          role="alert"
          className="rounded-control border-danger/25 bg-danger-soft text-danger mb-5 border px-4 py-3 text-sm"
        >
          {mutationError}
        </p>
      ) : null}
      <section
        aria-labelledby="project-tasks-title"
        className="rounded-card border-border bg-card shadow-panel w-full max-w-full min-w-0 border p-5 sm:p-6"
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2
              id="project-tasks-title"
              className="font-display text-lg font-semibold"
            >
              Tareas
            </h2>
            <p className="text-muted-foreground mt-1 text-sm leading-6">
              Trabajo organizado según las etapas del proyecto.
            </p>
          </div>
          {!readOnly && view === "active" && editor === "closed" ? (
            <Button
              size="sm"
              onClick={() => openCreate()}
              disabled={busy || formUnavailable}
            >
              Nueva tarea
            </Button>
          ) : null}
        </div>

        <div
          className="border-border mt-5 flex gap-1 border-b"
          role="tablist"
          aria-label="Vista de tareas"
        >
          {(["active", "archived"] as const).map((candidate) => (
            <button
              key={candidate}
              type="button"
              role="tab"
              aria-selected={view === candidate}
              className={
                view === candidate
                  ? "border-primary text-foreground border-b-2 px-3 py-2 text-sm font-semibold"
                  : "text-muted-foreground hover:text-foreground px-3 py-2 text-sm font-semibold"
              }
              onClick={() => {
                setView(candidate);
                closeEditor();
                setArchiveTarget(null);
                setMutationError(null);
              }}
            >
              {candidate === "active" ? "Activas" : "Archivadas"}
            </button>
          ))}
        </div>

        {stagesQuery.isError ? (
          <div
            role="alert"
            className="rounded-control border-danger/25 bg-danger-soft mt-4 flex flex-wrap items-center justify-between gap-3 border p-3"
          >
            <p className="text-danger text-sm">No pudimos cargar las etapas.</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void stagesQuery.refetch()}
            >
              Reintentar etapas
            </Button>
          </div>
        ) : null}

        {assignmentsQuery.isError ? (
          <div
            role="alert"
            className="rounded-control border-danger/25 bg-danger-soft mt-4 flex flex-wrap items-center justify-between gap-3 border p-3"
          >
            <p className="text-danger text-sm">
              No pudimos cargar el equipo del proyecto.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void assignmentsQuery.refetch()}
            >
              Reintentar equipo
            </Button>
          </div>
        ) : null}

        {!readOnly && archiveTarget ? (
          <div className="rounded-control border-danger/25 bg-danger-soft mt-5 space-y-3 border p-4">
            <p className="text-sm font-semibold">
              Archivar {archiveTarget.title}
            </p>
            <p className="text-muted-foreground text-sm leading-6">
              La tarea permanecerá en el historial del proyecto y podrás
              restaurarla.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={busy}
                onClick={() => setArchiveTarget(null)}
              >
                Volver
              </Button>
              <Button
                size="sm"
                disabled={busy}
                onClick={() => void confirmArchive()}
              >
                Confirmar archivo
              </Button>
            </div>
          </div>
        ) : null}

        {!readOnly && editor !== "closed" ? (
          <div className="border-border mt-6 border-t pt-5">
            {formUnavailable ? (
              <p className="text-danger text-sm">
                No pudimos preparar el formulario de tareas.
              </p>
            ) : (
              <ProjectTaskForm
                key={createStageId ?? "new"}
                projectStartDate={projectStartDate}
                stages={stagesQuery.data.stages}
                activeAssignments={assignmentsQuery.data.active}
                defaultStageId={createStageId}
                submitOnEnter
                onSubmit={saveTask}
                onCancel={closeEditor}
              />
            )}
          </div>
        ) : (
          <div className="mt-6">
            {view === "archived" && taskQuery.data.tasks.length === 0 ? (
              <div className="border-primary/40 border-l-2 pl-4">
                <h3 className="text-sm font-semibold">
                  No hay tareas archivadas
                </h3>
                <p className="text-muted-foreground mt-1 text-sm leading-6">
                  Las tareas archivadas aparecerán aquí y podrán restaurarse.
                </p>
              </div>
            ) : view === "active" && stagesQuery.data ? (
              <ProjectTaskBoard
                stages={stagesQuery.data.stages}
                stageTaskStatusCounts={stageTaskStatusCounts}
                tasks={taskQuery.data.tasks}
                disabled={busy}
                readOnly={readOnly}
                taskOpenerRef={taskOpenerRef}
                updatingTaskIds={updatingTaskIds}
                onCreate={openCreate}
                onEdit={selectTask}
                onArchive={setArchiveTarget}
                onStatusChange={(task, status) =>
                  void changeTaskStatus(task, status)
                }
              />
            ) : (
              <ProjectTaskList
                tasks={taskQuery.data.tasks}
                view={view}
                disabled={busy}
                readOnly={readOnly}
                taskOpenerRef={taskOpenerRef}
                updatingTaskIds={updatingTaskIds}
                onEdit={selectTask}
                onArchive={setArchiveTarget}
                onStatusChange={(task, status) =>
                  void changeTaskStatus(task, status)
                }
              />
            )}

            {totalPages > 1 ? (
              <nav
                aria-label="Paginación de tareas"
                className="border-border mt-6 flex items-center justify-between gap-3 border-t pt-4"
              >
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1 || busy}
                  onClick={() =>
                    setPages((current) => ({
                      ...current,
                      [view]: Math.max(1, current[view] - 1),
                    }))
                  }
                >
                  Anterior
                </Button>
                <span className="text-muted-foreground text-xs font-medium">
                  Página {page} de {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages || busy}
                  onClick={() =>
                    setPages((current) => ({
                      ...current,
                      [view]: current[view] + 1,
                    }))
                  }
                >
                  Siguiente
                </Button>
              </nav>
            ) : null}
          </div>
        )}
      </section>

      {scheduleQuery.data || (view === "active" && scheduleQuery.isError) ? (
        <div className="mt-5">
          {scheduleQuery.data ? (
            <ProjectTaskTimeline
              schedule={scheduleQuery.data}
              projectStatus={projectStatus}
              taskOpenerRef={taskOpenerRef}
              updatingTaskIds={updatingTaskIds}
              readOnly={readOnly}
              onOpenTask={selectTask}
              onStatusChange={(task, status) =>
                void changeTaskStatus(task, status)
              }
              onDateRangeChange={changeTaskDates}
            />
          ) : null}

          {view === "active" && scheduleQuery.isError ? (
            <section className="rounded-card border-danger/25 bg-card mb-5 border p-5">
              <p className="text-danger text-sm">
                No pudimos cargar el cronograma.
              </p>
              <Button
                className="mt-3"
                variant="outline"
                size="sm"
                onClick={() => void scheduleQuery.refetch()}
              >
                Reintentar cronograma
              </Button>
            </section>
          ) : null}
        </div>
      ) : null}
      {taskSheet}
    </>
  );
}
