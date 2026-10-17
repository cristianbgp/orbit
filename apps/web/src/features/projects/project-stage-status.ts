import type { ProjectTaskScheduleStageTaskStatusCounts } from "@/lib/api/generated/models";

export type ProjectStageStatus =
  "empty" | "pending" | "in_progress" | "blocked" | "completed";

export const projectStageStatusLabels = {
  empty: "Sin tareas",
  pending: "Pendiente",
  in_progress: "En curso",
  blocked: "Suspendida",
  completed: "Completada",
} satisfies Record<ProjectStageStatus, string>;

export function deriveProjectStageStatus(
  counts: ProjectTaskScheduleStageTaskStatusCounts,
): ProjectStageStatus {
  const total =
    counts.pending + counts.inProgress + counts.blocked + counts.completed;

  if (total === 0) return "empty";
  if (counts.completed === total) return "completed";
  if (counts.blocked > 0) return "blocked";
  if (counts.inProgress > 0 || counts.completed > 0) return "in_progress";
  return "pending";
}
