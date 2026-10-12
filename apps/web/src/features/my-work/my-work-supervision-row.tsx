import { useState } from "react";
import { keepPreviousData } from "@tanstack/react-query";
import { CalendarDays, ChevronDown, Flag } from "lucide-react";
import { Link } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type {
  MySupervisedProject,
  MyWorkTask,
  ProjectTask,
  ProjectTaskStatus,
} from "@/lib/api/generated/models";
import { useListProjectTasks } from "@/lib/api/generated/project-tasks/project-tasks";
import { formatCalendarWeekday } from "@/lib/calendar-date-presentation";
import { cn } from "@/lib/utils";
import { MyWorkProjectProgress } from "./my-work-project-progress";
import {
  formatMyWorkDate,
  MyWorkTaskRow,
  type MyWorkDisplayTask,
} from "./my-work-task-row";

const PAGE_SIZE = 25;

export function MyWorkSupervisionRow({
  project,
  expanded,
  expandedPage,
  busyTaskId,
  onToggle,
  onExpandedPage,
  onOpenTask,
  onStatus,
}: {
  project: MySupervisedProject;
  expanded: boolean;
  expandedPage: number;
  busyTaskId: string | null;
  onToggle(): void;
  onExpandedPage(page: number): void;
  onOpenTask(task: MyWorkTask | ProjectTask, opener: HTMLElement): void;
  onStatus(task: MyWorkTask | ProjectTask, status: ProjectTaskStatus): void;
}) {
  const [showAll, setShowAll] = useState(false);
  const allTasks = useListProjectTasks(
    project.id,
    { view: "active", page: expandedPage, pageSize: PAGE_SIZE },
    {
      query: {
        enabled: expanded && showAll,
        placeholderData: keepPreviousData,
      },
    },
  );
  const contentId = `my-work-supervision-${project.id}`;
  const displayed: MyWorkDisplayTask[] = showAll
    ? (allTasks.data?.tasks ?? []).map((task) => ({
        ...task,
        project: { id: project.id, name: project.name, client: project.client },
      }))
    : project.attentionTasks;

  function toggle() {
    if (expanded) setShowAll(false);
    onToggle();
  }

  return (
    <article className="min-w-0">
      <div className="hover:bg-muted/55 relative grid min-w-0 gap-x-3 gap-y-3 px-4 py-3 pr-16 transition-colors sm:grid-cols-2 sm:px-5 sm:pr-16 lg:grid-cols-[minmax(12rem,1fr)_7rem_7.5rem_minmax(12rem,15rem)] lg:items-center xl:grid-cols-[minmax(14rem,1fr)_7.5rem_8rem_minmax(15rem,18rem)]">
        <div className="flex min-w-0 gap-2 sm:col-span-2 lg:col-span-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={`${expanded ? "Ocultar" : "Ver"} tareas de ${project.name}`}
            aria-controls={contentId}
            aria-expanded={expanded}
            className="size-11 sm:right-5 lg:size-9"
            onClick={toggle}
          >
            <ChevronDown
              aria-hidden="true"
              className={cn("transition-transform", expanded && "rotate-180")}
            />
          </Button>
          <Link
            to={`/projects/${project.id}`}
            className="focus-visible:ring-ring hover:text-primary block min-h-11 min-w-0 rounded-sm text-sm font-semibold outline-none focus-visible:ring-2 lg:min-h-0"
          >
            <span className="block truncate">{project.name}</span>
            <span className="text-muted-foreground block truncate text-xs font-normal">
              {project.client.name}
            </span>
          </Link>
        </div>
        <ProjectDate
          icon={CalendarDays}
          label="Inicio"
          value={project.startDate}
        />
        <ProjectDate icon={Flag} label="Final" value={project.endDate} />
        <MyWorkProjectProgress
          projectName={project.name}
          counts={project.counts}
        />
      </div>
      {expanded ? (
        <div id={contentId} className="border-border bg-muted/20 border-t">
          <div className="flex min-h-12 items-center justify-between gap-3 px-4 sm:px-5">
            <h3 className="text-sm font-semibold">
              {showAll ? "Todas las tareas activas" : "Requieren atención"}
            </h3>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setShowAll((current) => !current)}
            >
              {showAll ? "Ver solo atención" : "Ver todas"}
            </Button>
          </div>
          {showAll && allTasks.isPending && !allTasks.data ? (
            <div
              aria-label="Cargando tareas del proyecto"
              className="space-y-2 p-4"
            >
              <Skeleton className="h-20" />
              <Skeleton className="h-20" />
            </div>
          ) : null}
          {showAll && allTasks.isError && !allTasks.data ? (
            <div className="border-danger m-4 border-l-2 pl-4 text-sm">
              <p>No pudimos cargar las tareas del proyecto.</p>
              <Button
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={() => void allTasks.refetch()}
              >
                Intentar de nuevo
              </Button>
            </div>
          ) : null}
          {displayed.length ? (
            <div className="divide-border divide-y border-t">
              {displayed.map((task) => (
                <MyWorkTaskRow
                  key={task.id}
                  task={task}
                  busy={busyTaskId !== null}
                  showProjectContext={false}
                  onOpen={(opener) => onOpenTask(task, opener)}
                  onStatus={(status) => onStatus(task, status)}
                />
              ))}
            </div>
          ) : !showAll || !allTasks.isPending ? (
            <p className="text-muted-foreground border-border border-t px-5 py-5 text-sm">
              {showAll
                ? "Este proyecto no tiene tareas activas."
                : "No hay tareas que requieran atención con estos filtros."}
            </p>
          ) : null}
          {showAll && allTasks.data ? (
            <Pagination
              page={allTasks.data.pagination.page}
              totalPages={allTasks.data.pagination.totalPages}
              onPage={onExpandedPage}
            />
          ) : null}
        </div>
      ) : null}
    </article>
  );
}

function ProjectDate({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof CalendarDays;
  label: string;
  value: string;
}) {
  return (
    <span className="text-muted-foreground inline-flex items-center gap-1.5 text-xs">
      <Icon aria-hidden="true" className="size-3.5 shrink-0" />
      <span>
        <span className="block font-medium">{label}</span>
        <span className="block capitalize">{formatCalendarWeekday(value)}</span>
        <span className="text-foreground block font-semibold tabular-nums">
          {formatMyWorkDate(value)}
        </span>
      </span>
    </span>
  );
}

function Pagination({
  page,
  totalPages,
  onPage,
}: {
  page: number;
  totalPages: number;
  onPage(page: number): void;
}) {
  if (totalPages <= 1) return null;
  return (
    <nav
      aria-label="Paginación de tareas supervisadas"
      className="border-border flex items-center justify-between border-t px-4 py-3 sm:px-5"
    >
      <Button
        variant="outline"
        size="sm"
        disabled={page <= 1}
        onClick={() => onPage(page - 1)}
      >
        Anterior
      </Button>
      <span className="text-muted-foreground text-xs">
        Página {page} de {totalPages}
      </span>
      <Button
        variant="outline"
        size="sm"
        disabled={page >= totalPages}
        onClick={() => onPage(page + 1)}
      >
        Siguiente
      </Button>
    </nav>
  );
}
