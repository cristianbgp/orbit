import type { ProjectTaskStatus } from "@/lib/api/generated/models";

export const PROJECT_TASK_STATUS_LABELS: Record<ProjectTaskStatus, string> = {
  pending: "Pendiente",
  in_progress: "En trabajo",
  blocked: "Suspendida",
  completed: "Completada",
};

export function projectTaskStatusLabel(status: ProjectTaskStatus) {
  return PROJECT_TASK_STATUS_LABELS[status];
}
