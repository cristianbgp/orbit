import {
  CalendarClock,
  CalendarDays,
  CircleAlert,
  CircleCheck,
  Clock3,
  TriangleAlert,
  type LucideIcon,
} from "lucide-react";

import type { ProjectStatus } from "@/lib/api/generated/models";
import { cn } from "@/lib/utils";
import { formatProjectCalendarDate } from "./project-presentation";

export type ProjectDeadlineState =
  "planned" | "scheduled" | "upcoming" | "due_today" | "overdue" | "completed";

const DAY_IN_MILLISECONDS = 86_400_000;

function calendarDayOrdinal(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return Date.UTC(year, month - 1, day) / DAY_IN_MILLISECONDS;
}

export function deriveProjectDeadlineState({
  projectStatus,
  deadline,
  today,
}: {
  projectStatus: ProjectStatus;
  deadline: string;
  today: string;
}): ProjectDeadlineState {
  if (projectStatus === "draft") return "planned";
  if (projectStatus === "completed") return "completed";

  const daysUntilDeadline =
    calendarDayOrdinal(deadline) - calendarDayOrdinal(today);
  if (daysUntilDeadline < 0) return "overdue";
  if (daysUntilDeadline === 0) return "due_today";
  if (daysUntilDeadline <= 7) return "upcoming";
  return "scheduled";
}

const statePresentation: Record<
  ProjectDeadlineState,
  { label: string; icon: LucideIcon; className: string }
> = {
  planned: {
    label: "Planificada",
    icon: CalendarClock,
    className: "bg-muted text-muted-foreground",
  },
  scheduled: {
    label: "Programada",
    icon: CalendarDays,
    className: "bg-info-soft text-task-status-in-progress",
  },
  upcoming: {
    label: "Próxima",
    icon: Clock3,
    className: "bg-warning-soft text-warning",
  },
  due_today: {
    label: "Finaliza hoy",
    icon: TriangleAlert,
    className: "bg-warning-soft text-warning",
  },
  overdue: {
    label: "Fecha final excedida",
    icon: CircleAlert,
    className: "bg-danger-soft text-danger",
  },
  completed: {
    label: "Proyecto completado",
    icon: CircleCheck,
    className: "bg-success-soft text-task-status-completed",
  },
};

export function ProjectDeadlineStatus({
  date,
  projectStatus,
  today,
  variant = "default",
}: {
  date: string;
  projectStatus: ProjectStatus;
  today: string;
  variant?: "default" | "inline";
}) {
  const state = deriveProjectDeadlineState({
    projectStatus,
    deadline: date,
    today,
  });
  const presentation = statePresentation[state];
  const Icon = presentation.icon;
  const deadlineLabel = "Fecha final";
  const formattedDate = formatProjectCalendarDate(date);

  return (
    <span
      role="group"
      aria-label={`${deadlineLabel}: ${formattedDate}, ${presentation.label}`}
      data-deadline-state={state}
      data-deadline-variant={variant}
      className={cn(
        "rounded-control min-w-0",
        presentation.className,
        variant === "inline"
          ? "inline-flex flex-wrap items-center gap-x-2 gap-y-1 px-2.5 py-1.5 text-xs"
          : "flex items-start gap-3 px-3 py-3",
      )}
    >
      <Icon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
      {variant === "inline" ? (
        <>
          <span className="font-semibold">{deadlineLabel}</span>
          <span className="font-medium tabular-nums">{formattedDate}</span>
          <span className="font-semibold">{presentation.label}</span>
        </>
      ) : (
        <span className="grid min-w-0 gap-1">
          <span className="flex flex-wrap items-baseline gap-x-2">
            <span className="font-semibold">{deadlineLabel}</span>
            <span className="font-semibold">{presentation.label}</span>
          </span>
          <span className="font-medium tabular-nums">{formattedDate}</span>
        </span>
      )}
    </span>
  );
}
