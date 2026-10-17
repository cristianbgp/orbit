import type { ProjectTaskStatus } from "@/lib/api/generated/models";
import {
  CircleCheckBig,
  CircleDotDashed,
  CirclePause,
  Clock3,
  type LucideIcon,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { projectTaskStatusLabel } from "./project-task-labels";

const statuses: ProjectTaskStatus[] = [
  "pending",
  "in_progress",
  "blocked",
  "completed",
];

const statusClasses = {
  pending: "border-transparent bg-muted text-task-status-pending",
  in_progress: "border-transparent bg-info-soft text-task-status-in-progress",
  blocked: "border-transparent bg-danger-soft text-task-status-blocked",
  completed: "border-transparent bg-success-soft text-task-status-completed",
} satisfies Record<ProjectTaskStatus, string>;

const statusIcons = {
  pending: Clock3,
  in_progress: CircleDotDashed,
  blocked: CirclePause,
  completed: CircleCheckBig,
} satisfies Record<ProjectTaskStatus, LucideIcon>;

export function ProjectTaskStatusSelect({
  taskTitle,
  value,
  disabled = false,
  display = "label",
  onValueChange,
  className,
}: {
  taskTitle: string;
  value: ProjectTaskStatus;
  disabled?: boolean;
  display?: "label" | "icon";
  onValueChange(status: ProjectTaskStatus): void;
  className?: string;
}) {
  const iconOnly = display === "icon";
  const StatusIcon = statusIcons[value];

  return (
    <Select
      value={value}
      disabled={disabled}
      onValueChange={(status) => {
        if (status !== value) onValueChange(status as ProjectTaskStatus);
      }}
    >
      <SelectTrigger
        size="sm"
        showChevron={!iconOnly}
        aria-label={`Cambiar estado de ${taskTitle}. Estado actual: ${projectTaskStatusLabel(value)}`}
        className={cn(
          "rounded-full text-xs font-semibold shadow-none",
          iconOnly
            ? "!size-11 justify-center gap-0 p-0 lg:!size-8"
            : "h-11 px-2.5 md:h-7",
          statusClasses[value],
          className,
        )}
      >
        {iconOnly ? (
          <StatusIcon
            aria-hidden="true"
            className="size-4 text-current"
            strokeWidth={2}
          />
        ) : (
          <SelectValue />
        )}
      </SelectTrigger>
      <SelectContent position="popper" align="end">
        {statuses.map((status) => (
          <SelectItem key={status} value={status}>
            {projectTaskStatusLabel(status)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
