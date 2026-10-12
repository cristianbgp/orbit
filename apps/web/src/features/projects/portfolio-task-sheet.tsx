import type { RefObject } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  getListProjectTaskCalendarQueryKey,
  getListUndatedProjectTasksQueryKey,
} from "@/lib/api/generated/project-tasks/project-tasks";
import { useGetProject } from "@/lib/api/generated/projects/projects";
import { ApiClientError } from "@/lib/api/fetcher";
import { ProjectTaskSheet } from "./project-task-sheet";

export function PortfolioTaskSheet({
  taskProjectId,
  taskId,
  open,
  openerRef,
  onOpenChange,
  onSaved,
}: {
  taskProjectId: string | null;
  taskId: string | null;
  open: boolean;
  openerRef: RefObject<HTMLElement | null>;
  onOpenChange(open: boolean): void;
  onSaved?(): void;
}) {
  const queryClient = useQueryClient();
  const projectQuery = useGetProject(taskProjectId ?? "", {
    query: { enabled: open && taskProjectId !== null && taskId !== null },
  });

  if (!open || !taskProjectId || !taskId) return null;

  const projectIsMissing =
    projectQuery.error instanceof ApiClientError &&
    projectQuery.error.status === 404;

  if (projectQuery.data) {
    const project = projectQuery.data.project;
    return (
      <ProjectTaskSheet
        projectId={project.id}
        projectStartDate={project.startDate}
        taskId={taskId}
        open
        openerRef={openerRef}
        readOnly={project.archivedAt !== null}
        projectContext={{
          name: project.name,
          clientName: project.client.name,
        }}
        onOpenChange={onOpenChange}
        onSaved={() => {
          void Promise.allSettled([
            queryClient.invalidateQueries({
              queryKey: getListProjectTaskCalendarQueryKey(),
            }),
            queryClient.invalidateQueries({
              queryKey: getListUndatedProjectTasksQueryKey(),
            }),
          ]);
          onSaved?.();
        }}
      />
    );
  }

  return (
    <Sheet open onOpenChange={onOpenChange}>
      <SheetContent
        className="w-[calc(100vw-1rem)] overflow-y-auto overscroll-contain sm:max-w-xl"
        onCloseAutoFocus={(event) => {
          const opener = openerRef.current;
          if (!opener?.isConnected) return;
          event.preventDefault();
          opener.focus();
        }}
      >
        <SheetHeader className="border-border border-b px-4 pt-5 pr-24 pb-4 sm:px-6 sm:pr-14">
          <SheetTitle>
            {projectIsMissing
              ? "Tarea no disponible"
              : projectQuery.isError
                ? "No pudimos abrir la tarea"
                : "Cargando tarea"}
          </SheetTitle>
          <SheetDescription>
            {projectIsMissing
              ? "El proyecto de esta tarea ya no está disponible."
              : projectQuery.isError
                ? "No pudimos comprobar el proyecto de esta tarea."
                : "Estamos comprobando el proyecto y sus permisos."}
          </SheetDescription>
        </SheetHeader>
        {projectQuery.isPending ? (
          <div
            aria-label="Cargando proyecto de la tarea"
            className="rounded-control bg-muted mx-4 h-40 animate-pulse sm:mx-6"
          />
        ) : null}
        {projectIsMissing ? (
          <p className="text-muted-foreground mx-4 text-sm sm:mx-6">
            La tarea fue eliminada o ya no tienes acceso a su proyecto.
          </p>
        ) : null}
        {projectQuery.isError && !projectIsMissing ? (
          <div className="mx-4 space-y-3 sm:mx-6">
            <p className="text-danger text-sm">
              Revisa tu conexión e inténtalo nuevamente.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void projectQuery.refetch()}
            >
              Intentar de nuevo
            </Button>
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
