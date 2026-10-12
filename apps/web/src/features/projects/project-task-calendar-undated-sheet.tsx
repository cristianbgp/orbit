import { useEffect, useMemo, useState, type RefObject } from "react";
import { keepPreviousData } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useListUndatedProjectTasks } from "@/lib/api/generated/project-tasks/project-tasks";
import type { UndatedProjectTaskContext } from "@/lib/api/generated/models";
import { ProjectTaskStatusBadge } from "./project-task-status-badge";
import type { ProjectTaskCalendarFilterState } from "./project-task-calendar-filters";

const PAGE_SIZE = 25;

function groupByProject(tasks: UndatedProjectTaskContext[]) {
  const groups = new Map<string, UndatedProjectTaskContext[]>();
  for (const task of tasks) {
    groups.set(task.project.id, [...(groups.get(task.project.id) ?? []), task]);
  }
  return [...groups.values()];
}

export function ProjectTaskCalendarUndatedSheet({
  open,
  filters,
  today: _today,
  openerRef,
  onOpenChange,
  onOpenTask,
  taskHref,
  onOpenProject,
}: {
  open: boolean;
  filters: ProjectTaskCalendarFilterState;
  today: string;
  openerRef: RefObject<HTMLElement | null>;
  onOpenChange(open: boolean): void;
  onOpenTask(projectId: string, taskId: string, opener: HTMLElement): void;
  taskHref?(projectId: string, taskId: string): string;
  onOpenProject(projectId: string): void;
}) {
  const [page, setPage] = useState(1);
  const filterKey = JSON.stringify(filters);

  useEffect(() => setPage(1), [filterKey]);

  const query = useListUndatedProjectTasks(
    {
      ...(filters.projectIds.length ? { projectIds: filters.projectIds } : {}),
      ...(filters.responsibleUserIds.length
        ? { responsibleUserIds: filters.responsibleUserIds }
        : {}),
      ...(filters.statuses.length ? { statuses: filters.statuses } : {}),
      ...(filters.search ? { search: filters.search } : {}),
      ...(filters.overdueOnly ? { overdueOnly: "true" } : {}),
      page,
      pageSize: PAGE_SIZE,
    },
    { query: { enabled: open, placeholderData: keepPreviousData } },
  );
  const groups = useMemo(
    () => groupByProject(query.data?.tasks ?? []),
    [query.data?.tasks],
  );
  const pagination = query.data?.pagination;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
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
          <SheetTitle className="font-display text-xl">
            Tareas sin fechas
          </SheetTitle>
          <SheetDescription>
            Trabajo que todavía necesita un inicio planificado.
          </SheetDescription>
        </SheetHeader>

        {query.isPending && !query.data ? (
          <div
            aria-label="Cargando tareas sin fechas"
            className="space-y-3 px-4 pb-6 sm:px-6"
          >
            {[0, 1, 2].map((item) => (
              <div
                key={item}
                className="rounded-control bg-muted h-24 animate-pulse"
              />
            ))}
          </div>
        ) : null}

        {query.isError ? (
          <div
            role="alert"
            className="rounded-control border-danger/25 bg-danger-soft text-danger mx-4 border p-3 text-sm sm:mx-6"
          >
            <p>No pudimos cargar las tareas sin fechas.</p>
            <Button
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={() => void query.refetch()}
            >
              Intentar de nuevo
            </Button>
          </div>
        ) : null}

        {!query.isPending && !query.isError && groups.length === 0 ? (
          <p className="rounded-control bg-muted text-muted-foreground mx-4 px-4 py-6 text-sm sm:mx-6">
            Todas las tareas coincidentes tienen fechas planificadas.
          </p>
        ) : null}

        {groups.length > 0 ? (
          <div
            className="space-y-6 px-4 pb-6 sm:px-6"
            aria-busy={query.isPlaceholderData}
          >
            {groups.map((tasks) => {
              const project = tasks[0]!.project;
              return (
                <section
                  key={project.id}
                  className="space-y-3"
                  aria-labelledby={`undated-${project.id}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3
                        id={`undated-${project.id}`}
                        className="truncate text-sm font-semibold"
                      >
                        {project.name}
                      </h3>
                      <p className="text-muted-foreground truncate text-xs">
                        {project.client.name}
                      </p>
                    </div>
                    <a
                      href={`/projects/${project.id}`}
                      aria-label={`Abrir proyecto ${project.name}`}
                      className="text-primary focus-visible:ring-ring text-xs font-semibold hover:underline focus-visible:ring-2 focus-visible:outline-none"
                      onClick={(event) => {
                        event.preventDefault();
                        onOpenChange(false);
                        onOpenProject(project.id);
                      }}
                    >
                      Ver proyecto
                    </a>
                  </div>
                  <div className="space-y-2">
                    {tasks.map((task) => (
                      <div
                        key={task.id}
                        className="rounded-control border-border bg-card border p-3 shadow-sm"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold">
                              {task.title}
                            </p>
                            <p className="text-muted-foreground mt-1 text-xs">
                              {task.stage.name}
                            </p>
                            <p className="text-muted-foreground mt-1 truncate text-xs">
                              {task.responsibles
                                .map(
                                  ({ userAlias, userName }) =>
                                    userAlias ?? userName,
                                )
                                .join(", ") || "Sin encargados"}
                            </p>
                          </div>
                          <ProjectTaskStatusBadge
                            status={task.status}
                            className="shrink-0"
                          />
                        </div>
                        <Button
                          asChild
                          variant="outline"
                          size="sm"
                          className="mt-3"
                        >
                          <a
                            href={
                              taskHref?.(project.id, task.id) ??
                              `/projects/${project.id}?task=${task.id}`
                            }
                            aria-label={`Agregar fechas a ${task.title}`}
                            onClick={(event) => {
                              event.preventDefault();
                              onOpenChange(false);
                              onOpenTask(
                                project.id,
                                task.id,
                                event.currentTarget,
                              );
                            }}
                          >
                            Agregar fechas
                          </a>
                        </Button>
                      </div>
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        ) : null}

        {pagination && pagination.totalPages > 1 ? (
          <nav
            aria-label="Paginación de tareas sin fechas"
            className="border-border mt-auto flex items-center justify-between gap-3 border-t px-4 py-3 sm:px-6"
          >
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1 || query.isPlaceholderData}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
            >
              Anterior
            </Button>
            <span className="text-muted-foreground text-xs">
              Página {pagination.page} de {pagination.totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={
                page >= pagination.totalPages || query.isPlaceholderData
              }
              onClick={() => setPage((current) => current + 1)}
            >
              Siguiente
            </Button>
          </nav>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
