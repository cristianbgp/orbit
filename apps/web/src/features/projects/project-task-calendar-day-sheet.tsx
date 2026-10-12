import type { RefObject } from "react";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { CalendarCheck, CalendarDays, Flag } from "lucide-react";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type {
  ProjectTaskCalendarContext,
  ProjectTaskCalendarResponse,
} from "@/lib/api/generated/models";
import { cn } from "@/lib/utils";
import { ProjectTaskStatusBadge } from "./project-task-status-badge";

function fullDate(date: string) {
  return format(parseISO(date), "EEEE, d 'de' MMMM 'de' yyyy", { locale: es });
}

function tasksForDate(tasks: ProjectTaskCalendarContext[], date: string) {
  return tasks
    .filter(
      (task) =>
        task.plannedStartDate <= date &&
        (task.internalDueDate ?? task.plannedStartDate) >= date,
    )
    .sort((left, right) => {
      const completedOrder =
        Number(left.status === "completed") -
        Number(right.status === "completed");
      return (
        completedOrder ||
        (left.internalDueDate ?? left.plannedStartDate).localeCompare(
          right.internalDueDate ?? right.plannedStartDate,
        ) ||
        left.title.localeCompare(right.title, "es") ||
        left.id.localeCompare(right.id)
      );
    });
}

export function ProjectTaskCalendarDaySheet({
  date,
  data,
  open,
  openerRef,
  onOpenChange,
  onOpenTask,
  taskHref,
  onOpenProject,
}: {
  date: string | null;
  data: ProjectTaskCalendarResponse;
  open: boolean;
  openerRef: RefObject<HTMLElement | null>;
  onOpenChange(open: boolean): void;
  onOpenTask(projectId: string, taskId: string, opener: HTMLElement): void;
  taskHref?(projectId: string, taskId: string): string;
  onOpenProject(projectId: string): void;
}) {
  const selectedDate = date ?? "";
  const tasks = date ? tasksForDate(data.tasks, date) : [];
  const markers = date
    ? data.markers.filter((marker) => marker.date === date)
    : [];
  const empty = tasks.length === 0 && markers.length === 0;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        className="w-[calc(100vw-1rem)] overflow-y-auto overscroll-contain sm:max-w-lg"
        onCloseAutoFocus={(event) => {
          const opener = openerRef.current;
          if (!opener?.isConnected) return;
          event.preventDefault();
          opener.focus();
        }}
      >
        <SheetHeader className="border-border border-b px-4 pt-5 pr-24 pb-4 sm:px-6 sm:pr-14">
          <SheetTitle className="font-display text-xl">
            Agenda del día
          </SheetTitle>
          <SheetDescription className="capitalize">
            {selectedDate ? fullDate(selectedDate) : "Selecciona una fecha"}
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-7 px-4 pb-6 sm:px-6">
          {empty ? (
            <p className="rounded-control bg-muted text-muted-foreground px-4 py-6 text-sm">
              No hay tareas ni fechas del proyecto este día.
            </p>
          ) : null}

          {tasks.length > 0 ? (
            <section aria-labelledby="day-tasks-title" className="space-y-3">
              <h3
                id="day-tasks-title"
                className="text-foreground text-sm font-semibold"
              >
                Tareas ({tasks.length})
              </h3>
              <div className="space-y-2">
                {tasks.map((task) => (
                  <a
                    key={task.id}
                    href={
                      taskHref?.(task.project.id, task.id) ??
                      `/projects/${task.project.id}?task=${task.id}`
                    }
                    aria-label={`${task.title}. ${task.project.name}. ${task.stage.name}`}
                    className={cn(
                      "rounded-control border-border bg-card text-foreground hover:bg-muted/50 focus-visible:ring-ring block border p-3 shadow-sm transition-colors focus-visible:ring-2 focus-visible:outline-none",
                      task.status === "completed" && "opacity-75",
                    )}
                    onClick={(event) => {
                      event.preventDefault();
                      onOpenChange(false);
                      onOpenTask(task.project.id, task.id, event.currentTarget);
                    }}
                  >
                    <span className="flex items-start justify-between gap-3">
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold">
                          {task.title}
                        </span>
                        <span className="text-muted-foreground mt-1 block text-xs">
                          {task.project.name} · {task.stage.name}
                        </span>
                      </span>
                      <ProjectTaskStatusBadge
                        status={task.status}
                        className="shrink-0"
                      />
                    </span>
                  </a>
                ))}
              </div>
            </section>
          ) : null}

          {markers.length > 0 ? (
            <section
              aria-labelledby="day-project-dates-title"
              className="space-y-3"
            >
              <h3
                id="day-project-dates-title"
                className="text-foreground text-sm font-semibold"
              >
                Fechas del proyecto ({markers.length})
              </h3>
              <div className="space-y-2">
                {markers.map((marker) => (
                  <a
                    key={`${marker.projectId}-${marker.kind}-${marker.eventId ?? marker.date}`}
                    href={`/projects/${marker.projectId}`}
                    aria-label={`${marker.kind === "project_start" ? "Inicio del proyecto" : marker.kind === "project_end" ? "Fin del proyecto" : (marker.eventTitle ?? "Evento legal")}. ${marker.projectName}`}
                    className="rounded-control border-border bg-card text-foreground hover:bg-muted/50 focus-visible:ring-ring flex min-h-11 items-center gap-3 border p-3 text-sm shadow-sm focus-visible:ring-2 focus-visible:outline-none"
                    onClick={(event) => {
                      event.preventDefault();
                      onOpenChange(false);
                      onOpenProject(marker.projectId);
                    }}
                  >
                    <span
                      className={cn(
                        "bg-card flex size-8 shrink-0 items-center justify-center rounded-full border",
                        marker.kind === "project_start"
                          ? "border-amber-500 text-amber-700"
                          : marker.kind === "project_end"
                            ? "border-primary text-primary"
                            : "border-danger text-danger",
                      )}
                    >
                      {marker.kind === "project_start" ? (
                        <Flag aria-hidden="true" className="size-4" />
                      ) : marker.kind === "project_end" ? (
                        <CalendarCheck aria-hidden="true" className="size-4" />
                      ) : (
                        <CalendarDays aria-hidden="true" className="size-4" />
                      )}
                    </span>
                    <span className="min-w-0">
                      <span className="block font-semibold">
                        {marker.kind === "project_start"
                          ? "Inicio del proyecto"
                          : marker.kind === "project_end"
                            ? "Fin del proyecto"
                            : (marker.eventTitle ?? "Evento legal")}
                      </span>
                      <span className="text-muted-foreground block truncate text-xs">
                        {marker.projectName} · {marker.clientName}
                      </span>
                    </span>
                  </a>
                ))}
              </div>
            </section>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}
