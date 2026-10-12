import { useRef, useState } from "react";
import { keepPreviousData } from "@tanstack/react-query";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { CalendarClock, ChevronLeft, ChevronRight } from "lucide-react";
import { useLocation } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { useListProjectTaskCalendar } from "@/lib/api/generated/project-tasks/project-tasks";
import type { ProjectTaskCalendarResponse } from "@/lib/api/generated/models";
import { ProjectCalendarLegend } from "./project-calendar-legend";
import { ProjectTaskCalendarAgenda } from "./project-task-calendar-agenda";
import { ProjectTaskCalendarDaySheet } from "./project-task-calendar-day-sheet";
import {
  ProjectTaskCalendarFilters,
  type ProjectTaskCalendarFilterState,
} from "./project-task-calendar-filters";
import { ProjectTaskCalendarGrid } from "./project-task-calendar-grid";
import {
  currentProjectTaskCalendarMonth,
  getProjectTaskCalendarVisibleRange,
  layoutProjectTaskCalendar,
  parseProjectTaskCalendarMonth,
  shiftProjectTaskCalendarMonth,
} from "./project-task-calendar-layout";
import { ProjectTaskCalendarUndatedSheet } from "./project-task-calendar-undated-sheet";

function monthLabel(month: string) {
  const parsed = parseProjectTaskCalendarMonth(month);
  if (!parsed) return month;
  const label = format(parsed, "MMMM 'de' yyyy", { locale: es });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function ProjectTaskCalendar({
  month,
  today,
  filters,
  onFiltersChange,
  onMonthChange,
  onOpenTask,
  onOpenProject,
}: {
  month: string;
  today: string;
  filters: ProjectTaskCalendarFilterState;
  onFiltersChange(filters: ProjectTaskCalendarFilterState): void;
  onMonthChange(month: string): void;
  onOpenTask(projectId: string, taskId: string, opener: HTMLElement): void;
  onOpenProject(projectId: string): void;
}) {
  const location = useLocation();
  const range = getProjectTaskCalendarVisibleRange(month);
  const query = useListProjectTaskCalendar(
    {
      from: range.from,
      to: range.to,
      ...(filters.projectIds.length ? { projectIds: filters.projectIds } : {}),
      ...(filters.responsibleUserIds.length
        ? { responsibleUserIds: filters.responsibleUserIds }
        : {}),
      ...(filters.statuses.length ? { statuses: filters.statuses } : {}),
      ...(filters.search ? { search: filters.search } : {}),
      ...(filters.overdueOnly ? { overdueOnly: "true" } : {}),
    },
    { query: { placeholderData: keepPreviousData } },
  );
  const settled = useRef<{
    month: string;
    data: ProjectTaskCalendarResponse;
  } | null>(null);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [undatedOpen, setUndatedOpen] = useState(false);
  const dayOpenerRef = useRef<HTMLElement | null>(null);
  const undatedOpenerRef = useRef<HTMLElement | null>(null);

  if (query.data && !query.isPlaceholderData && !query.isError) {
    settled.current = { month, data: query.data };
  }
  const displayed =
    (query.isPlaceholderData || query.isError) && settled.current
      ? settled.current
      : query.data
        ? { month, data: query.data }
        : null;
  const layout = displayed
    ? layoutProjectTaskCalendar(
        displayed.data.tasks,
        displayed.data.markers,
        displayed.month,
        today,
      )
    : null;
  const hasFilters =
    filters.search !== "" ||
    filters.projectIds.length > 0 ||
    filters.responsibleUserIds.length > 0 ||
    filters.statuses.length > 0 ||
    filters.overdueOnly;

  function openDay(date: string, opener: HTMLElement) {
    dayOpenerRef.current = opener;
    setSelectedDay(date);
  }

  function taskHref(projectId: string, taskId: string) {
    const params = new URLSearchParams(location.search);
    params.set("display", "calendar");
    params.set("month", displayed?.month ?? month);
    params.set("taskProject", projectId);
    params.set("task", taskId);
    return `/projects?${params.toString()}`;
  }

  return (
    <section
      aria-labelledby="project-task-calendar-title"
      className="space-y-4"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2
            id="project-task-calendar-title"
            className="font-display text-xl font-semibold"
          >
            {monthLabel(displayed?.month ?? month)}
          </h2>
          <p className="text-muted-foreground mt-1 text-sm">
            Tareas planificadas, periodos y eventos de la cartera activa.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            aria-label={`Tareas sin fechas${displayed ? `: ${displayed.data.undatedTaskCount}` : ""}`}
            onClick={(event) => {
              undatedOpenerRef.current = event.currentTarget;
              setUndatedOpen(true);
            }}
          >
            <CalendarClock aria-hidden="true" />
            Sin fechas {displayed ? `(${displayed.data.undatedTaskCount})` : ""}
          </Button>
          <Button
            variant="outline"
            size="icon-sm"
            aria-label="Mes anterior"
            onClick={() =>
              onMonthChange(shiftProjectTaskCalendarMonth(month, -1))
            }
          >
            <ChevronLeft aria-hidden="true" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            aria-label="Ir al mes actual"
            onClick={() =>
              onMonthChange(currentProjectTaskCalendarMonth(today))
            }
          >
            Hoy
          </Button>
          <Button
            variant="outline"
            size="icon-sm"
            aria-label="Mes siguiente"
            onClick={() =>
              onMonthChange(shiftProjectTaskCalendarMonth(month, 1))
            }
          >
            <ChevronRight aria-hidden="true" />
          </Button>
        </div>
      </div>

      <ProjectTaskCalendarFilters value={filters} onChange={onFiltersChange} />
      <ProjectCalendarLegend />

      {query.isFetching && displayed ? (
        <p role="status" className="text-muted-foreground text-xs">
          Actualizando…
        </p>
      ) : null}
      {displayed?.data.truncated ? (
        <p
          role="status"
          className="rounded-control border border-amber-500/35 bg-amber-50 px-3 py-2 text-sm text-amber-900"
        >
          Mostramos las primeras 500 tareas. Usa los filtros para acotar el
          calendario.
        </p>
      ) : null}
      {query.isError && displayed ? (
        <div className="rounded-control border-danger/25 bg-danger-soft flex flex-wrap items-center justify-between gap-3 border px-3 py-2">
          <p className="text-danger text-sm">
            No pudimos actualizar el calendario de tareas.
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void query.refetch()}
          >
            Intentar de nuevo
          </Button>
        </div>
      ) : null}

      {query.isPending && !displayed ? (
        <div
          aria-label="Cargando calendario de tareas"
          className="rounded-card border-border bg-muted h-96 animate-pulse border"
        />
      ) : query.isError && !displayed ? (
        <div className="rounded-card border-danger/25 bg-card border p-6 text-center">
          <p className="text-danger text-sm">
            No pudimos cargar el calendario de tareas.
          </p>
          <Button
            className="mt-4"
            variant="outline"
            size="sm"
            onClick={() => void query.refetch()}
          >
            Intentar de nuevo
          </Button>
        </div>
      ) : layout &&
        layout.segments.length === 0 &&
        Object.keys(layout.markersByDate).length === 0 ? (
        <div className="rounded-card border-border bg-card border border-dashed p-8 text-center">
          <p className="font-medium">
            {hasFilters
              ? "No hay tareas con estos filtros."
              : "No hay tareas planificadas en este mes."}
          </p>
          <p className="text-muted-foreground mt-1 text-sm">
            {hasFilters
              ? "Prueba con otros criterios."
              : "Las tareas aparecerán cuando tengan fechas planificadas."}
          </p>
        </div>
      ) : layout ? (
        <>
          <ProjectTaskCalendarGrid
            layout={layout}
            month={displayed?.month ?? month}
            today={today}
            onOpenTask={onOpenTask}
            taskHref={taskHref}
            onOpenDay={openDay}
            onOpenProject={onOpenProject}
          />
          <ProjectTaskCalendarAgenda
            layout={layout}
            onOpenTask={onOpenTask}
            taskHref={taskHref}
            onOpenProject={onOpenProject}
          />
        </>
      ) : null}

      {displayed ? (
        <>
          <ProjectTaskCalendarDaySheet
            date={selectedDay}
            data={displayed.data}
            open={selectedDay !== null}
            openerRef={dayOpenerRef}
            onOpenChange={(open) => {
              if (!open) setSelectedDay(null);
            }}
            onOpenTask={onOpenTask}
            taskHref={taskHref}
            onOpenProject={onOpenProject}
          />
          <ProjectTaskCalendarUndatedSheet
            open={undatedOpen}
            filters={filters}
            today={today}
            openerRef={undatedOpenerRef}
            onOpenChange={setUndatedOpen}
            onOpenTask={onOpenTask}
            taskHref={taskHref}
            onOpenProject={onOpenProject}
          />
        </>
      ) : null}
    </section>
  );
}
