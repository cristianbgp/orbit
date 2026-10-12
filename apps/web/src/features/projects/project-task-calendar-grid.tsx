import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { CircleCheck, CirclePause, TriangleAlert } from "lucide-react";

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { isWeekendCalendarDate } from "@/lib/calendar-weekend";
import { projectTaskCalendarTone } from "./project-task-calendar-colors";
import { projectCalendarMarkerPresentation } from "./project-calendar-marker-presentation";
import type {
  ProjectTaskCalendarLayout,
  ProjectTaskCalendarSegment,
} from "./project-task-calendar-layout";
import { projectTaskStatusLabel } from "./project-task-labels";

const weekdayLabels = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

function fullDate(date: string) {
  return format(parseISO(date), "EEEE, d 'de' MMMM 'de' yyyy", { locale: es });
}

function shortDate(date: string) {
  return format(parseISO(date), "d MMM yyyy", { locale: es });
}

function taskDescription(segment: ProjectTaskCalendarSegment) {
  const { task } = segment;
  const aliases = task.responsibles
    .map(({ userAlias, userName }) => userAlias ?? userName)
    .join(", ");
  const effectiveEnd = task.internalDueDate ?? task.plannedStartDate;

  return `${task.title}. Proyecto: ${task.project.name}. Cliente: ${task.project.client.name}. Etapa: ${task.stage.name}. Estado: ${projectTaskStatusLabel(task.status)}. Encargados: ${aliases || "Sin encargados"}. Del ${fullDate(task.plannedStartDate)} al ${fullDate(effectiveEnd)}.`;
}

function TaskStatusSignal({
  segment,
  today,
}: {
  segment: ProjectTaskCalendarSegment;
  today?: string;
}) {
  const { task } = segment;
  const overdue =
    task.status !== "completed" &&
    task.internalDueDate !== null &&
    today !== undefined &&
    task.internalDueDate < today;

  if (task.status === "blocked") {
    return (
      <CirclePause
        aria-hidden="true"
        data-testid="task-status-blocked"
        className="text-danger size-3.5 shrink-0"
      />
    );
  }
  if (task.status === "completed") {
    return (
      <CircleCheck
        aria-hidden="true"
        data-testid="task-status-completed"
        className="text-success size-3.5 shrink-0"
      />
    );
  }
  if (overdue) {
    return (
      <TriangleAlert
        aria-hidden="true"
        data-testid="task-overdue"
        className="text-danger size-3.5 shrink-0"
      />
    );
  }
  return null;
}

function DeadlineButtons({
  date,
  layout,
  onOpenDay,
  onOpenProject,
}: {
  date: string;
  layout: ProjectTaskCalendarLayout;
  onOpenDay(date: string, opener: HTMLElement): void;
  onOpenProject(projectId: string): void;
}) {
  const markers = layout.markersByDate[date] ?? [];

  return (
    <div className="absolute top-9 left-1.5 z-20 flex items-center gap-1">
      {(["project_start", "project_end", "project_event"] as const).map(
        (kind) => {
          const matching = markers.filter((marker) => marker.kind === kind);
          if (matching.length === 0) return null;
          const presentation = projectCalendarMarkerPresentation(kind);
          const MarkerIcon = presentation.Icon;
          const kindLabel =
            kind === "project_start"
              ? "inicio de proyecto"
              : kind === "project_end"
                ? "fin de proyecto"
                : "evento legal";
          const label = `${matching.length} ${kindLabel} el ${fullDate(date)}`;

          return (
            <Tooltip key={kind}>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  aria-label={label}
                  className={cn(
                    "rounded-control bg-card focus-visible:ring-ring inline-flex min-h-7 min-w-7 items-center justify-center gap-0.5 border px-1 text-[10px] font-semibold shadow-sm focus-visible:ring-2 focus-visible:outline-none",
                    presentation.frameTone,
                  )}
                  onClick={(event) => {
                    if (matching.length === 1) {
                      onOpenProject(matching[0]!.projectId);
                      return;
                    }
                    onOpenDay(date, event.currentTarget);
                  }}
                >
                  <MarkerIcon aria-hidden="true" className="size-3" />
                  {matching.length > 1 ? <span>{matching.length}</span> : null}
                </button>
              </TooltipTrigger>
              <TooltipContent sideOffset={6} className="max-w-72 space-y-1">
                {matching.map((marker) => (
                  <p
                    key={`${marker.projectId}-${marker.kind}-${marker.eventId ?? marker.date}`}
                  >
                    {marker.eventTitle ? `${marker.eventTitle} · ` : ""}
                    {marker.projectName} · {marker.clientName}
                  </p>
                ))}
              </TooltipContent>
            </Tooltip>
          );
        },
      )}
    </div>
  );
}

export function ProjectTaskCalendarGrid({
  layout,
  month,
  today,
  onOpenTask,
  taskHref,
  onOpenDay,
  onOpenProject,
}: {
  layout: ProjectTaskCalendarLayout;
  month: string;
  today?: string;
  onOpenTask(projectId: string, taskId: string, opener: HTMLElement): void;
  taskHref?(projectId: string, taskId: string): string;
  onOpenDay(date: string, opener: HTMLElement): void;
  onOpenProject(projectId: string): void;
}) {
  return (
    <TooltipProvider>
      <div
        role="grid"
        aria-label="Calendario mensual de tareas"
        className="rounded-card border-border bg-card hidden overflow-hidden border md:block"
      >
        <div
          role="row"
          className="border-border bg-muted/40 grid grid-cols-7 border-b"
        >
          {weekdayLabels.map((label, index) => {
            const isWeekend = index >= 5;
            return (
              <div
                key={label}
                role="columnheader"
                data-weekend={isWeekend ? "true" : undefined}
                className={cn(
                  "border-border text-muted-foreground border-r px-3 py-2 text-xs font-semibold last:border-r-0",
                  isWeekend && "bg-muted/70 text-foreground/80",
                )}
              >
                {label}
              </div>
            );
          })}
        </div>

        {layout.weeks.map((week) => {
          const segments = layout.segments.filter(
            (segment) => segment.weekIndex === week.index,
          );

          return (
            <div
              key={week.from}
              role="row"
              aria-label={`Semana del ${fullDate(week.from)}`}
              className="border-border relative h-[216px] border-b last:border-b-0"
            >
              <div className="absolute inset-0 grid grid-cols-7">
                {week.dates.map((date) => {
                  const isToday = layout.today?.date === date;
                  const outsideMonth = !date.startsWith(month);
                  const isWeekend = isWeekendCalendarDate(date);
                  const overflow = layout.overflowByDate[date] ?? 0;

                  return (
                    <div
                      key={date}
                      role="gridcell"
                      aria-label={fullDate(date)}
                      aria-current={isToday ? "date" : undefined}
                      data-weekend={isWeekend ? "true" : undefined}
                      className={cn(
                        "border-border relative border-r p-2 text-right text-xs last:border-r-0",
                        outsideMonth && "bg-muted/25 text-muted-foreground",
                        isWeekend && "bg-muted/60",
                        isToday && "bg-primary/8 text-primary",
                      )}
                    >
                      <span
                        className={cn(
                          "inline-flex size-6 items-center justify-center rounded-full",
                          isToday &&
                            "bg-primary text-primary-foreground font-semibold",
                        )}
                      >
                        {format(parseISO(date), "d")}
                      </span>
                      <DeadlineButtons
                        date={date}
                        layout={layout}
                        onOpenDay={onOpenDay}
                        onOpenProject={onOpenProject}
                      />
                      {overflow > 0 ? (
                        <button
                          type="button"
                          className="rounded-control bg-muted text-foreground hover:bg-border focus-visible:ring-ring absolute right-1.5 bottom-1.5 left-1.5 z-20 min-h-7 px-1.5 text-left text-[11px] font-semibold focus-visible:ring-2 focus-visible:outline-none"
                          aria-label={`${overflow} tareas adicionales el ${fullDate(date)}`}
                          onClick={(event) =>
                            onOpenDay(date, event.currentTarget)
                          }
                        >
                          +{overflow} tareas
                        </button>
                      ) : null}
                    </div>
                  );
                })}
              </div>

              {segments.map((segment) => {
                const { task } = segment;
                const tone = projectTaskCalendarTone(task.project.id);
                const aliases = task.responsibles
                  .map(({ userAlias, userName }) => userAlias ?? userName)
                  .join(", ");

                return (
                  <Tooltip key={`${task.id}-${segment.weekIndex}`}>
                    <TooltipTrigger asChild>
                      <a
                        href={
                          taskHref?.(task.project.id, task.id) ??
                          `/projects/${task.project.id}?task=${task.id}`
                        }
                        data-lane={segment.lane}
                        aria-label={taskDescription(segment)}
                        className={cn(
                          "focus-visible:ring-ring absolute z-10 flex h-7 items-center gap-1.5 overflow-hidden border px-2 text-xs font-semibold shadow-xs transition-colors hover:brightness-95 focus-visible:ring-2 focus-visible:outline-none",
                          tone.bar,
                          tone.border,
                          tone.text,
                          segment.continuesBefore
                            ? "rounded-l-none"
                            : "rounded-l-md",
                          segment.continuesAfter
                            ? "rounded-r-none"
                            : "rounded-r-md",
                          task.status === "completed" &&
                            "line-through opacity-75",
                        )}
                        style={{
                          left: `calc(${(segment.startColumn / 7) * 100}% + 3px)`,
                          width: `calc(${(segment.span / 7) * 100}% - 6px)`,
                          top: 68 + segment.lane * 32,
                        }}
                        onClick={(event) => {
                          event.preventDefault();
                          onOpenTask(
                            task.project.id,
                            task.id,
                            event.currentTarget,
                          );
                        }}
                      >
                        <span
                          className={cn(
                            "size-2 shrink-0 rounded-full",
                            tone.dot,
                          )}
                        />
                        <TaskStatusSignal
                          segment={segment}
                          today={today ?? layout.today?.date}
                        />
                        <span className="truncate">
                          <span className="font-medium">
                            {task.project.name}:
                          </span>{" "}
                          {task.title}
                        </span>
                      </a>
                    </TooltipTrigger>
                    <TooltipContent
                      sideOffset={6}
                      className="max-w-80 space-y-1"
                    >
                      <p className="font-semibold">{task.title}</p>
                      <p>
                        {task.project.name} · {task.stage.name}
                      </p>
                      <p>{task.project.client.name}</p>
                      <p>
                        {shortDate(task.plannedStartDate)} -{" "}
                        {shortDate(
                          task.internalDueDate ?? task.plannedStartDate,
                        )}
                      </p>
                      <p>Encargados: {aliases || "Sin encargados"}</p>
                    </TooltipContent>
                  </Tooltip>
                );
              })}
            </div>
          );
        })}
      </div>
    </TooltipProvider>
  );
}
