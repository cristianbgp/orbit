import type { ProjectTaskStatus } from "@/lib/api/generated/models";
import { cn } from "@/lib/utils";
import { projectTaskStatusLabel } from "./project-task-labels";

const statusClasses = {
  pending: "bg-muted text-task-status-pending",
  in_progress: "bg-info-soft text-task-status-in-progress",
  blocked: "bg-danger-soft text-task-status-blocked",
  completed: "bg-success-soft text-task-status-completed",
} satisfies Record<ProjectTaskStatus, string>;

type ProjectTaskStatusBadgeProps = {
  status: ProjectTaskStatus | string;
  className?: string;
};

function isProjectTaskStatus(status: string): status is ProjectTaskStatus {
  return Object.prototype.hasOwnProperty.call(statusClasses, status);
}

export function ProjectTaskStatusBadge({
  status,
  className,
}: ProjectTaskStatusBadgeProps) {
  const knownStatus = isProjectTaskStatus(status);

  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2.5 py-1 text-xs font-semibold",
        knownStatus ? statusClasses[status] : statusClasses.pending,
        className,
      )}
    >
      {knownStatus ? projectTaskStatusLabel(status) : "Estado desconocido"}
    </span>
  );
}
