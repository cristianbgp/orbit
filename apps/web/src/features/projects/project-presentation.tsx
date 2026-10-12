import type { ProjectStatus } from "@/lib/api/generated/models";
import { cn } from "@/lib/utils";
import { PROJECT_STATUS_LABELS } from "./project-labels";

export function formatProjectCalendarDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Intl.DateTimeFormat("es-PE", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })
    .format(new Date(year, month - 1, day))
    .replaceAll(".", "");
}

export function ProjectStatusBadge({ status }: { status: ProjectStatus }) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2.5 py-1 text-xs font-semibold",
        status === "active" && "bg-success-soft text-success",
        status === "completed" && "bg-info-soft text-primary-strong",
        status === "draft" && "bg-muted text-muted-foreground",
      )}
    >
      {PROJECT_STATUS_LABELS[status]}
    </span>
  );
}
