import { UserRoundX } from "lucide-react";

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { MySupervisedProjectCounts } from "@/lib/api/generated/models";
import { cn } from "@/lib/utils";

const statuses = [
  {
    key: "pending",
    label: "Pendientes",
    className: "bg-task-status-pending",
  },
  {
    key: "inProgress",
    label: "En trabajo",
    className: "bg-task-status-in-progress",
  },
  {
    key: "blocked",
    label: "Suspendidas",
    className: "bg-task-status-blocked",
  },
  {
    key: "completed",
    label: "Completadas",
    className: "bg-task-status-completed",
  },
] as const;

export function MyWorkProjectProgress({
  projectName,
  counts,
}: {
  projectName: string;
  counts: MySupervisedProjectCounts;
}) {
  const taskCountLabel = counts.total === 1 ? "tarea" : "tareas";

  return (
    <TooltipProvider>
      <div
        role="group"
        aria-label={`Progreso de tareas en ${projectName}`}
        className="min-w-0 space-y-2.5 sm:col-span-2 lg:col-span-1 lg:space-y-2 lg:self-center xl:space-y-2.5"
      >
        {counts.total > 0 ? (
          <div
            role="img"
            aria-label={`${counts.total} ${taskCountLabel}: ${statuses.map(({ key, label }) => `${label.toLowerCase()} ${counts[key]}`).join(", ")}`}
            className="bg-muted flex h-2.5 w-full overflow-hidden rounded-full"
          >
            {statuses.map(({ key, label, className }) => {
              const count = counts[key];
              if (count === 0) return null;
              const percentage = Math.round((count / counts.total) * 100);
              return (
                <Tooltip key={key}>
                  <TooltipTrigger asChild>
                    <span
                      tabIndex={0}
                      aria-label={`${label}: ${count}, ${percentage}%`}
                      className={cn(
                        "focus-visible:ring-ring relative block h-full outline-none focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-inset",
                        className,
                      )}
                      style={{ width: `${(count / counts.total) * 100}%` }}
                    />
                  </TooltipTrigger>
                  <TooltipContent>
                    {label}: {count} ({percentage}%)
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </div>
        ) : (
          <div className="bg-muted text-muted-foreground flex h-8 items-center justify-center rounded-md text-xs font-medium">
            Sin tareas
          </div>
        )}
        <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
          {statuses.map(({ key, label, className }) => (
            <span
              key={key}
              className="text-muted-foreground inline-flex min-w-0 items-center gap-1.5"
            >
              <span
                aria-hidden="true"
                className={cn("size-2 shrink-0 rounded-full", className)}
              />
              {label}{" "}
              <strong className="text-foreground tabular-nums">
                {counts[key]}
              </strong>
            </span>
          ))}
        </div>
        <span
          className={cn(
            "text-muted-foreground inline-flex items-center gap-1.5 text-xs",
            counts.unassigned > 0 && "text-warning",
          )}
        >
          <UserRoundX aria-hidden="true" className="size-3.5 shrink-0" />
          Sin encargado
          <strong className="text-foreground tabular-nums">
            {counts.unassigned}
          </strong>
        </span>
      </div>
    </TooltipProvider>
  );
}
