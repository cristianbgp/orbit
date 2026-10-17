import {
  Circle,
  CircleCheckBig,
  CircleDotDashed,
  CirclePause,
  Clock3,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";
import {
  projectStageStatusLabels,
  type ProjectStageStatus,
} from "./project-stage-status";

const statusPresentation = {
  empty: {
    icon: Circle,
    className: "bg-muted text-muted-foreground",
    barClassName: "border border-border bg-muted text-muted-foreground",
  },
  pending: {
    icon: Clock3,
    className: "bg-muted text-task-status-pending",
    barClassName: "bg-task-status-pending text-white",
  },
  in_progress: {
    icon: CircleDotDashed,
    className: "bg-info-soft text-task-status-in-progress",
    barClassName: "bg-task-status-in-progress text-white",
  },
  blocked: {
    icon: CirclePause,
    className: "bg-danger-soft text-task-status-blocked",
    barClassName: "bg-task-status-blocked text-white",
  },
  completed: {
    icon: CircleCheckBig,
    className: "bg-success-soft text-task-status-completed",
    barClassName: "bg-task-status-completed text-white",
  },
} satisfies Record<
  ProjectStageStatus,
  { icon: LucideIcon; className: string; barClassName: string }
>;

export function projectStageStatusBarClass(status: ProjectStageStatus) {
  return statusPresentation[status].barClassName;
}

export function ProjectStageStatusIndicator({
  status,
  display = "badge",
  className,
}: {
  status: ProjectStageStatus;
  display?: "badge" | "icon";
  className?: string;
}) {
  const label = projectStageStatusLabels[status];
  const presentation = statusPresentation[status];
  const Icon = presentation.icon;
  const iconOnly = display === "icon";

  return (
    <span
      aria-label={`Estado de etapa: ${label}`}
      className={cn(
        "inline-flex shrink-0 items-center font-semibold",
        iconOnly ? "gap-0" : "gap-1.5 rounded-full px-2 py-1 text-xs",
        presentation.className,
        iconOnly && "bg-transparent",
        className,
      )}
    >
      <Icon aria-hidden="true" className="size-4" strokeWidth={2} />
      <span className={iconOnly ? "sr-only" : undefined}>{label}</span>
    </span>
  );
}
