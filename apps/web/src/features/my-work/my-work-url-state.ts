import type { ProjectTaskStatus } from "@/lib/api/generated/models";

const statuses = new Set<ProjectTaskStatus>([
  "pending",
  "in_progress",
  "blocked",
  "completed",
]);
const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const views = new Set<MyWorkView>(["tasks", "supervision", "case-actions"]);

export type MyWorkView = "tasks" | "supervision" | "case-actions";

function page(value: string | null) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
}

function unique(values: string[]) {
  return [...new Set(values.filter(Boolean))].sort();
}

export type MyWorkUrlState = ReturnType<typeof readMyWorkUrlState>;

export function readMyWorkUrlState(params: URLSearchParams) {
  const taskId = params.get("task");
  const taskProjectId = params.get("taskProject");
  const requestedView = params.get("view");
  return {
    view: views.has(requestedView as MyWorkView)
      ? (requestedView as MyWorkView)
      : "tasks",
    search: params.get("q")?.trim() ?? "",
    projectIds: unique(params.getAll("project")),
    statuses: unique(params.getAll("status")).filter(
      (value): value is ProjectTaskStatus =>
        statuses.has(value as ProjectTaskStatus),
    ),
    dateFrom: datePattern.test(params.get("from") ?? "")
      ? params.get("from")!
      : "",
    dateTo: datePattern.test(params.get("to") ?? "") ? params.get("to")! : "",
    includeCompleted: params.get("completed") === "1",
    assignedPage: page(params.get("assignedPage")),
    supervisionPage: page(params.get("supervisionPage")),
    actionPage: page(params.get("actionPage")),
    caseClientIds: unique(params.getAll("caseClient")),
    caseIds: unique(params.getAll("case")),
    caseTypes: unique(params.getAll("caseType")).filter(
      (
        value,
      ): value is "administrative" | "judicial" | "constitutional" | "other" =>
        ["administrative", "judicial", "constitutional", "other"].includes(
          value,
        ),
    ),
    includeCompletedActions: params.get("actionCompleted") === "1",
    expandedProjectId: params.get("expanded"),
    expandedPage: page(params.get("expandedPage")),
    taskId: taskId && taskProjectId ? taskId : null,
    taskProjectId: taskId && taskProjectId ? taskProjectId : null,
  };
}
