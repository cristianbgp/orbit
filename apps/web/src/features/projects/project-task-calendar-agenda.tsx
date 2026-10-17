import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { isWeekendCalendarDate } from "@/lib/calendar-weekend";
import { projectCalendarMarkerPresentation } from "./project-calendar-marker-presentation";
import { projectTaskCalendarTone } from "./project-task-calendar-colors";
import type { ProjectTaskCalendarLayout } from "./project-task-calendar-layout";
import { ProjectTaskStatusBadge } from "./project-task-status-badge";

function shortDate(date: string) {
  return format(parseISO(date), "d MMM yyyy", { locale: es });
}

function fullDate(date: string) {
  return format(parseISO(date), "EEEE, d 'de' MMMM 'de' yyyy", { locale: es });
}

export function ProjectTaskCalendarAgenda({
  layout,
  onOpenTask,
  taskHref,
  onOpenProject,
}: {
  layout: ProjectTaskCalendarLayout;
  onOpenTask(projectId: string, taskId: string, opener: HTMLElement): void;
  taskHref?(projectId: string, taskId: string): string;
  onOpenProject(projectId: string): void;
}) {
  const tasks = new Map(
    layout.segments.map((segment) => [segment.taskId, segment.task]),
  );
  const entries = new Map<
    string,
    {
      tasks: typeof tasks extends Map<string, infer Task> ? Task[] : never;
      markers: NonNullable<ProjectTaskCalendarLayout["markersByDate"][string]>;
    }
  >();

  for (const task of tasks.values()) {
    const date =
      task.plannedStartDate < layout.range.from
        ? layout.range.from
        : task.plannedStartDate;
    const current = entries.get(date) ?? { tasks: [], markers: [] };
    current.tasks.push(task);
    entries.set(date, current);
  }
  for (const [date, markers] of Object.entries(layout.markersByDate)) {
    const current = entries.get(date) ?? { tasks: [], markers: [] };
    current.markers.push(...markers);
    entries.set(date, current);
  }

  const days = [...entries.entries()].sort(([left], [right]) =>
    left.localeCompare(right),
  );

  return (
    <div
      role="region"
      aria-label="Agenda de tareas"
      className="space-y-4 md:hidden"
    >
      {days.map(([date, day]) => {
        const isWeekend = isWeekendCalendarDate(date);
        return (
          <section
            key={date}
            data-weekend={isWeekend ? "true" : undefined}
            className="rounded-card border-border bg-card shadow-panel overflow-hidden border"
          >
            <h3
              className={cn(
                "border-border bg-muted/35 border-b px-4 py-3 text-sm font-semibold capitalize",
                isWeekend && "bg-muted/60",
              )}
            >
              {fullDate(date)}
            </h3>
            <div className="divide-border divide-y">
              {day.tasks
                .sort(
                  (left, right) =>
                    Number(left.status === "completed") -
                      Number(right.status === "completed") ||
                    left.plannedStartDate.localeCompare(
                      right.plannedStartDate,
                    ) ||
                    left.position - right.position ||
                    left.id.localeCompare(right.id),
                )
                .map((task) => {
                  const tone = projectTaskCalendarTone(task.project.id);
                  const aliases = task.responsibles
                    .map(({ userAlias, userName }) => userAlias ?? userName)
                    .join(", ");
                  return (
                    <article key={task.id} className="space-y-3 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <a
                            href={
                              taskHref?.(task.project.id, task.id) ??
                              `/projects/${task.project.id}?task=${task.id}`
                            }
                            aria-label={`${task.title}. ${task.project.name}`}
                            className="text-foreground hover:text-primary focus-visible:ring-ring block truncate text-sm font-semibold focus-visible:ring-2 focus-visible:outline-none"
                            onClick={(event) => {
                              event.preventDefault();
                              onOpenTask(
                                task.project.id,
                                task.id,
                                event.currentTarget,
                              );
                            }}
                          >
                            {task.title}
                          </a>
                          <a
                            href={`/projects/${task.project.id}`}
                            className={cn(
                              "mt-1 block truncate text-xs font-semibold hover:underline",
                              tone.text,
                            )}
                            onClick={(event) => {
                              event.preventDefault();
                              onOpenProject(task.project.id);
                            }}
                          >
                            {task.project.name} · {task.project.client.name}
                          </a>
                        </div>
                        <ProjectTaskStatusBadge
                          status={task.status}
                          className="shrink-0"
                        />
                      </div>
                      <p className="text-muted-foreground text-xs">
                        {shortDate(task.plannedStartDate)} -{" "}
                        {shortDate(
                          task.internalDueDate ?? task.plannedStartDate,
                        )}
                      </p>
                      <p className="text-muted-foreground text-xs">
                        {task.stage.name} · {aliases || "Sin encargados"}
                      </p>
                    </article>
                  );
                })}
              {day.markers.map((deadline) => {
                const presentation = projectCalendarMarkerPresentation(
                  deadline.kind,
                );
                const MarkerIcon = presentation.Icon;
                return (
                  <a
                    key={`${deadline.projectId}-${deadline.kind}-${deadline.eventId ?? deadline.date}`}
                    href={`/projects/${deadline.projectId}`}
                    aria-label={`${deadline.projectName}. ${deadline.kind === "project_start" ? "Inicio del proyecto" : deadline.kind === "project_end" ? "Fin del proyecto" : `Evento legal ${deadline.eventTitle ?? ""}`}`}
                    className="hover:bg-muted/30 focus-visible:ring-ring flex min-h-12 items-center gap-3 p-4 text-sm focus-visible:ring-2 focus-visible:outline-none focus-visible:ring-inset"
                    onClick={(event) => {
                      event.preventDefault();
                      onOpenProject(deadline.projectId);
                    }}
                  >
                    <MarkerIcon
                      aria-hidden="true"
                      className={cn("size-4 shrink-0", presentation.iconTone)}
                    />
                    <span>
                      <span className="block font-semibold">
                        {deadline.kind === "project_start"
                          ? "Inicio del proyecto"
                          : deadline.kind === "project_end"
                            ? "Fin del proyecto"
                            : (deadline.eventTitle ?? "Evento legal")}
                      </span>
                      <span className="text-muted-foreground block text-xs">
                        {deadline.projectName} · {deadline.clientName}
                      </span>
                    </span>
                  </a>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
