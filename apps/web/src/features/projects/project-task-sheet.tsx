import { useEffect, useState, type RefObject } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { getListProjectActivitiesQueryKey } from "@/lib/api/generated/activity/activity";
import { useListProjectAssignments } from "@/lib/api/generated/project-collaboration/project-collaboration";
import { useListProjectStages } from "@/lib/api/generated/project-stages/project-stages";
import {
  getGetProjectTaskQueryKey,
  getGetProjectTaskScheduleQueryKey,
  getListProjectTasksQueryKey,
  useGetProjectTask,
  useReplaceProjectTaskResponsibles,
  useRestoreProjectTask,
  useUpdateProjectTask,
} from "@/lib/api/generated/project-tasks/project-tasks";
import type { ProjectTask } from "@/lib/api/generated/models";
import {
  ProjectTaskForm,
  type ProjectTaskFormInput,
} from "./project-task-form";
import { ProjectTaskResponsibleGroups } from "./project-task-responsible-groups";
import { formatProjectCalendarDate } from "./project-presentation";
import { ProjectTaskStatusBadge } from "./project-task-status-badge";

type ProjectTaskSheetProps = {
  projectId: string;
  projectStartDate: string;
  taskId: string | null;
  open: boolean;
  openerRef: RefObject<HTMLElement | null>;
  onOpenChange(open: boolean): void;
  onSaved(): void;
  readOnly?: boolean;
  projectContext?: {
    name: string;
    clientName: string;
  };
};

function errorStatus(error: unknown) {
  if (typeof error !== "object" || error === null || !("status" in error)) {
    return undefined;
  }
  return (error as { status?: number }).status;
}

function TaskSheetSkeleton() {
  return (
    <div
      aria-label="Cargando detalle de tarea"
      className="space-y-5 px-4 pb-6 sm:px-6"
    >
      <div className="rounded-control bg-muted h-11 animate-pulse" />
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-control bg-muted h-20 animate-pulse" />
        <div className="rounded-control bg-muted h-20 animate-pulse" />
      </div>
      <div className="rounded-control bg-muted h-28 animate-pulse" />
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-control bg-muted h-20 animate-pulse" />
        <div className="rounded-control bg-muted h-20 animate-pulse" />
      </div>
    </div>
  );
}

function ReadOnlyTaskDetails({ task }: { task: ProjectTask }) {
  return (
    <div className="space-y-6 px-4 pb-6 sm:px-6">
      <div className="flex flex-wrap items-center gap-2">
        {task.archivedAt ? (
          <span className="bg-muted text-foreground inline-flex rounded-full px-2.5 py-1 text-xs font-semibold">
            Archivada
          </span>
        ) : null}
        <ProjectTaskStatusBadge status={task.status} />
      </div>

      <dl className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-1.5">
          <dt className="text-muted-foreground text-xs font-semibold">Etapa</dt>
          <dd className="text-foreground text-sm font-medium">
            {task.stage.name}
          </dd>
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <dt className="text-muted-foreground text-xs font-semibold">
            Descripción
          </dt>
          <dd className="text-foreground text-sm leading-6 [overflow-wrap:anywhere]">
            {task.description ?? "Sin descripción"}
          </dd>
        </div>
        <div className="space-y-1.5">
          <dt className="text-muted-foreground text-xs font-semibold">
            Inicio planificado
          </dt>
          <dd className="text-foreground text-sm font-medium">
            {task.plannedStartDate
              ? formatProjectCalendarDate(task.plannedStartDate)
              : "Sin fecha definida"}
          </dd>
        </div>
        <div className="space-y-1.5">
          <dt className="text-muted-foreground text-xs font-semibold">
            Fecha límite
          </dt>
          <dd className="text-foreground text-sm font-medium">
            {task.internalDueDate
              ? formatProjectCalendarDate(task.internalDueDate)
              : "Sin fecha definida"}
          </dd>
        </div>
        <div className="space-y-2 sm:col-span-2">
          <dt className="text-muted-foreground text-xs font-semibold">
            Encargados
          </dt>
          <dd className="min-w-0">
            <ProjectTaskResponsibleGroups responsibles={task.responsibles} />
          </dd>
        </div>
      </dl>
    </div>
  );
}

export function ProjectTaskSheet({
  projectId,
  projectStartDate,
  taskId,
  open,
  openerRef,
  onOpenChange,
  onSaved,
  readOnly = false,
  projectContext,
}: ProjectTaskSheetProps) {
  const queryClient = useQueryClient();
  const safeTaskId = taskId ?? "";
  const taskQuery = useGetProjectTask(projectId, safeTaskId, {
    query: { enabled: open && taskId !== null },
  });
  const stagesQuery = useListProjectStages(projectId, {
    query: { enabled: open && !readOnly },
  });
  const assignmentsQuery = useListProjectAssignments(
    projectId,
    { historyPage: 1, historyPageSize: 1 },
    { query: { enabled: open && !readOnly } },
  );
  const updateMutation = useUpdateProjectTask({
    mutation: { onSuccess: () => onOpenChange(false) },
  });
  const replaceMutation = useReplaceProjectTaskResponsibles();
  const restoreMutation = useRestoreProjectTask();
  const [displayedTask, setDisplayedTask] = useState<ProjectTask | null>(null);
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const [partialSaveError, setPartialSaveError] = useState<string | null>(null);
  const [conflictError, setConflictError] = useState<string | null>(null);

  useEffect(() => {
    setRestoreError(null);
    setPartialSaveError(null);
    setConflictError(null);
    if (!open || taskId === null) setDisplayedTask(null);
  }, [open, projectId, taskId]);

  useEffect(() => {
    if (open && taskQuery.data?.task.id === taskId) {
      setDisplayedTask(taskQuery.data.task);
    }
  }, [open, taskId, taskQuery.data]);

  const queriedTask =
    taskQuery.data?.task.id === taskId ? taskQuery.data.task : undefined;
  const task = displayedTask?.id === taskId ? displayedTask : queriedTask;
  const archived = Boolean(task?.archivedAt);
  const formDataPending = stagesQuery.isPending || assignmentsQuery.isPending;
  const formDataUnavailable =
    stagesQuery.isError ||
    assignmentsQuery.isError ||
    !stagesQuery.data ||
    !assignmentsQuery.data;
  const taskUnavailable =
    taskId === null ||
    (!task && taskQuery.isError && errorStatus(taskQuery.error) === 404);

  async function invalidateTaskData() {
    if (taskId === null) return;
    await Promise.allSettled([
      queryClient.invalidateQueries({
        queryKey: getListProjectTasksQueryKey(projectId),
      }),
      queryClient.invalidateQueries({
        queryKey: getGetProjectTaskQueryKey(projectId, taskId),
        refetchType: "none",
      }),
      queryClient.invalidateQueries({
        queryKey: getListProjectActivitiesQueryKey(projectId),
      }),
      queryClient.invalidateQueries({
        queryKey: getGetProjectTaskScheduleQueryKey(projectId),
      }),
    ]);
  }

  async function refreshTaskDetail() {
    if (taskId === null) return false;
    try {
      const result = await taskQuery.refetch({ throwOnError: true });
      if (
        result.isError !== false ||
        result.isRefetchError !== false ||
        result.error !== null ||
        result.data?.task.id !== taskId
      ) {
        return false;
      }
      setDisplayedTask(result.data.task);
      queryClient.setQueryData(
        getGetProjectTaskQueryKey(projectId, taskId),
        result.data,
      );
      return true;
    } catch {
      return false;
    }
  }

  async function retryTaskDetail() {
    if (await refreshTaskDetail()) setConflictError(null);
  }

  async function saveTask(input: ProjectTaskFormInput) {
    if (!task || taskId === null) return;
    setPartialSaveError(null);
    setConflictError(null);
    const { responsibleUserIds, ...data } = input;
    let updateResult: { task: ProjectTask };
    try {
      updateResult = await updateMutation.mutateAsync({
        projectId,
        taskId,
        data,
      });
    } catch (error) {
      if (errorStatus(error) !== 409) {
        throw error;
      }
      const refreshed = await refreshTaskDetail();
      setConflictError(
        refreshed
          ? "La tarea cambió mientras la editabas. Mostramos la versión más reciente. Revisa los cambios antes de continuar."
          : "La tarea cambió mientras la editabas, pero no pudimos cargar la versión más reciente. Usa «Actualizar información» antes de continuar.",
      );
      return;
    }
    let authoritativeTask = updateResult.task;
    const currentResponsibleIds = task.responsibles
      .flatMap(({ userId }) => (userId === null ? [] : [userId]))
      .sort();
    const desiredResponsibleIds = [...responsibleUserIds].sort();
    if (
      currentResponsibleIds.join("\u0000") !==
      desiredResponsibleIds.join("\u0000")
    ) {
      try {
        const replaceResult = await replaceMutation.mutateAsync({
          projectId,
          taskId,
          data: { responsibleUserIds },
        });
        authoritativeTask = replaceResult.task;
      } catch (error) {
        setDisplayedTask(authoritativeTask);
        queryClient.setQueryData(getGetProjectTaskQueryKey(projectId, taskId), {
          task: authoritativeTask,
        });
        setPartialSaveError(
          "Los datos de la tarea se guardaron, pero los cambios en los encargados no se guardaron. Vuelve a seleccionarlos e inténtalo nuevamente.",
        );
        onSaved();

        const detailRefresh = refreshTaskDetail();
        const conflict = errorStatus(error) === 409;
        await Promise.allSettled([
          invalidateTaskData(),
          detailRefresh,
          ...(conflict ? [assignmentsQuery.refetch()] : []),
        ]);
        return;
      }
    }
    setDisplayedTask(authoritativeTask);
    queryClient.setQueryData(getGetProjectTaskQueryKey(projectId, taskId), {
      task: authoritativeTask,
    });
    onSaved();
    await invalidateTaskData();
  }

  async function restoreTask() {
    if (!task || taskId === null) return;
    setRestoreError(null);
    setConflictError(null);
    let restoredTask: ProjectTask;
    try {
      const restoreResult = await restoreMutation.mutateAsync({
        projectId,
        taskId,
      });
      restoredTask = restoreResult.task;
    } catch (error) {
      if (errorStatus(error) === 409) {
        const refreshed = await refreshTaskDetail();
        setConflictError(
          refreshed
            ? "La tarea cambió antes de restaurarla. Mostramos la versión más reciente. Revisa su estado antes de continuar."
            : "La tarea cambió antes de restaurarla, pero no pudimos cargar la versión más reciente. Usa «Actualizar información» antes de continuar.",
        );
        return;
      }
      setRestoreError("No pudimos restaurar la tarea. Inténtalo nuevamente.");
      return;
    }

    setDisplayedTask(restoredTask);
    queryClient.setQueryData(getGetProjectTaskQueryKey(projectId, taskId), {
      task: restoredTask,
    });
    onSaved();
    await invalidateTaskData();
    await refreshTaskDetail();
  }

  let title = task?.title ?? "Cargando tarea";
  let description = "Estamos preparando el detalle de la tarea.";
  if (taskUnavailable) {
    title = "Tarea no disponible";
    description = "Cierra este panel para continuar en el proyecto.";
  } else if (taskQuery.isError && !task) {
    title = "No pudimos abrir la tarea";
    description = "El resto del proyecto sigue disponible.";
  } else if (task) {
    description = readOnly
      ? "Consulta los datos de esta tarea en el proyecto archivado."
      : archived
        ? "Consulta los datos archivados o restaura la tarea para editarla."
        : "Edita los datos de esta tarea.";
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        className="w-[calc(100vw-1rem)] overflow-y-auto overscroll-contain sm:max-w-xl lg:max-w-2xl"
        onCloseAutoFocus={(event) => {
          const opener = openerRef.current;
          if (!opener?.isConnected) return;
          event.preventDefault();
          opener.focus();
        }}
      >
        <SheetHeader className="border-border border-b px-4 pt-5 pr-24 pb-4 sm:px-6 sm:pr-14">
          <SheetTitle className="font-display text-xl leading-7 [overflow-wrap:anywhere]">
            {title}
          </SheetTitle>
          <SheetDescription className="leading-6">
            {description}
          </SheetDescription>
          {projectContext ? (
            <div
              aria-label="Contexto del proyecto"
              className="rounded-control border-border bg-muted/40 mt-2 flex flex-wrap items-center justify-between gap-3 border px-3 py-2.5"
            >
              <div className="min-w-0 text-sm">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <Link
                    to={`/projects/${projectId}`}
                    className="text-primary focus-visible:ring-ring font-semibold underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:outline-none"
                    onClick={() => onOpenChange(false)}
                  >
                    {projectContext.name}
                  </Link>
                  <span aria-hidden="true" className="text-border">
                    ·
                  </span>
                  <span className="text-muted-foreground">
                    {projectContext.clientName}
                  </span>
                  {task ? (
                    <>
                      <span aria-hidden="true" className="text-border">
                        ·
                      </span>
                      <span className="text-muted-foreground">
                        {task.stage.name}
                      </span>
                    </>
                  ) : null}
                </div>
              </div>
              <Button asChild variant="outline" size="sm">
                <Link
                  to={`/projects/${projectId}`}
                  onClick={() => onOpenChange(false)}
                >
                  Ver proyecto
                </Link>
              </Button>
            </div>
          ) : null}
        </SheetHeader>

        {task && taskQuery.isRefetchError ? (
          <div
            role="status"
            className="rounded-control border-border bg-muted text-muted-foreground mx-4 flex flex-wrap items-center justify-between gap-3 border px-3 py-2 text-sm sm:mx-6"
          >
            <p>
              Mostramos la última información guardada porque no pudimos
              actualizarla.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void retryTaskDetail()}
            >
              Actualizar información
            </Button>
          </div>
        ) : null}

        {conflictError ? (
          <p
            role="alert"
            className="rounded-control border-danger/25 bg-danger-soft text-danger mx-4 border p-3 text-sm sm:mx-6"
          >
            {conflictError}
          </p>
        ) : null}

        {taskUnavailable ? (
          <div className="px-4 pb-6 sm:px-6">
            <p className="text-muted-foreground text-sm leading-6">
              La tarea seleccionada ya no está disponible.
            </p>
          </div>
        ) : taskQuery.isPending && !task ? (
          <TaskSheetSkeleton />
        ) : taskQuery.isError && !task ? (
          <div className="space-y-4 px-4 pb-6 sm:px-6">
            <p
              role="alert"
              className="rounded-control border-danger/25 bg-danger-soft text-danger border p-3 text-sm"
            >
              No pudimos cargar esta tarea.
            </p>
            <Button variant="outline" onClick={() => void taskQuery.refetch()}>
              Intentar de nuevo
            </Button>
          </div>
        ) : !task ? (
          <TaskSheetSkeleton />
        ) : readOnly ? (
          <ReadOnlyTaskDetails task={task} />
        ) : task.archivedAt ? (
          <>
            <ReadOnlyTaskDetails task={task} />
            <div className="border-border mt-auto border-t px-4 py-4 sm:px-6">
              {restoreError ? (
                <p
                  role="alert"
                  className="rounded-control border-danger/25 bg-danger-soft text-danger mb-3 border p-3 text-sm"
                >
                  {restoreError}
                </p>
              ) : null}
              <div className="flex justify-end">
                <Button
                  disabled={restoreMutation.isPending}
                  onClick={() => void restoreTask()}
                >
                  {restoreMutation.isPending ? "Restaurando…" : "Restaurar"}
                </Button>
              </div>
            </div>
          </>
        ) : formDataPending ? (
          <TaskSheetSkeleton />
        ) : formDataUnavailable ? (
          <div className="space-y-4 px-4 pb-6 sm:px-6">
            <p
              role="alert"
              className="rounded-control border-danger/25 bg-danger-soft text-danger border p-3 text-sm"
            >
              No pudimos cargar los datos para editar esta tarea.
            </p>
            <Button
              variant="outline"
              onClick={() => {
                void stagesQuery.refetch();
                void assignmentsQuery.refetch();
              }}
            >
              Intentar de nuevo
            </Button>
          </div>
        ) : (
          <div className="space-y-4 px-4 pb-6 sm:px-6">
            {partialSaveError ? (
              <p
                role="alert"
                className="rounded-control border-danger/25 bg-danger-soft text-danger border p-3 text-sm"
              >
                {partialSaveError}
              </p>
            ) : null}
            <ProjectTaskForm
              key={`${task.id}:${task.updatedAt}`}
              projectStartDate={projectStartDate}
              stages={stagesQuery.data.stages}
              activeAssignments={assignmentsQuery.data.active}
              initialTask={task}
              onSubmit={saveTask}
              onCancel={() => onOpenChange(false)}
            />
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
