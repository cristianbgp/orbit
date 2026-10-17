import { CalendarDays, Flag } from "lucide-react";
import { Link } from "react-router-dom";

import { ProjectTaskStatusSelect } from "@/features/projects/project-task-status-select";
import type {
  MyWorkTask,
  ProjectTask,
  ProjectTaskStatus,
} from "@/lib/api/generated/models";
import { formatCalendarWeekday } from "@/lib/calendar-date-presentation";
import { cn } from "@/lib/utils";
import { MyWorkTaskAssignees } from "./my-work-task-assignees";

export type MyWorkDisplayTask =
  MyWorkTask | (ProjectTask & { project: MyWorkTask["project"] });

const dateFormatter = new Intl.DateTimeFormat("es-PE", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

export function formatMyWorkDate(value: string) {
  return dateFormatter
    .format(new Date(`${value}T00:00:00.000Z`))
    .replaceAll(".", "");
}

export function MyWorkTaskRow({
  task,
  busy,
  showProjectContext = true,
  onOpen,
  onStatus,
}: {
  task: MyWorkDisplayTask;
  busy: boolean;
  showProjectContext?: boolean;
  onOpen(opener: HTMLElement): void;
  onStatus(status: ProjectTaskStatus): void;
}) {
  return (
    <article className="hover:bg-muted/55 grid min-w-0 grid-cols-[2.75rem_minmax(0,1fr)] gap-x-3 gap-y-2 px-4 py-3 transition-colors sm:px-5 lg:grid-cols-[2.75rem_minmax(11rem,1fr)_7.5rem_8.5rem_6.5rem] lg:items-center xl:grid-cols-[2.75rem_minmax(15rem,1fr)_8.5rem_9.5rem_7.5rem]">
      <div className="flex items-start pt-0.5 lg:items-center lg:justify-center lg:pt-0">
        <ProjectTaskStatusSelect
          taskTitle={task.title}
          value={task.status}
          disabled={busy}
          display="icon"
          onValueChange={onStatus}
        />
      </div>
      <div className="min-w-0">
        {showProjectContext ? (
          <>
            <span className="text-muted-foreground block text-xs font-medium">
              {task.project.client.name}
            </span>
            <Link
              to={`/projects/${task.project.id}`}
              className="text-primary hover:text-primary-strong focus-visible:ring-ring mt-0.5 block w-fit max-w-full rounded-sm text-xs font-semibold outline-none hover:underline focus-visible:ring-2"
            >
              <span className="line-clamp-2">{task.project.name}</span>
            </Link>
          </>
        ) : null}
        <button
          type="button"
          aria-label={`Abrir ${task.title}`}
          className={cn(
            "focus-visible:ring-ring hover:text-primary flex min-h-11 max-w-full items-center rounded-sm text-left text-sm font-semibold outline-none focus-visible:ring-2 lg:min-h-0",
            showProjectContext && "mt-1",
          )}
          onClick={(event) => onOpen(event.currentTarget)}
        >
          <span className="line-clamp-2">{task.title}</span>
        </button>
        <span className="text-muted-foreground block text-xs">
          {task.stage.name}
        </span>
      </div>
      <div className="col-start-2 grid min-w-0 grid-cols-2 gap-3 lg:contents">
        <TaskDate
          icon={CalendarDays}
          label="Inicio"
          value={task.plannedStartDate}
          fallback="Sin inicio"
        />
        <TaskDate
          icon={Flag}
          label="Fecha límite"
          value={task.internalDueDate}
          fallback="Sin fecha límite"
          emphasized
        />
      </div>
      <div className="col-start-2 min-w-0 lg:col-start-auto">
        <MyWorkTaskAssignees responsibles={task.responsibles} />
      </div>
    </article>
  );
}

function TaskDate({
  icon: Icon,
  label,
  value,
  fallback,
  emphasized = false,
}: {
  icon: typeof CalendarDays;
  label: string;
  value: string | null;
  fallback: string;
  emphasized?: boolean;
}) {
  return (
    <span className="text-muted-foreground inline-flex min-w-0 items-center gap-1.5 text-xs">
      <Icon aria-hidden="true" className="size-3.5 shrink-0" />
      <span>
        <span className="block font-medium">{label}</span>
        {value ? (
          <span className="block capitalize">
            {formatCalendarWeekday(value)}
          </span>
        ) : null}
        <span
          className={
            emphasized && value
              ? "text-foreground block font-semibold tabular-nums"
              : "block tabular-nums"
          }
        >
          {value ? formatMyWorkDate(value) : fallback}
        </span>
      </span>
    </span>
  );
}
