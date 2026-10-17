import type {
  ProjectTaskStatus,
  TaskResponsibleRecord,
} from "../project-tasks/project-task-types";

export type MyWorkActor = { userId: string; organizationId: string };

export type MyWorkQuery = {
  page?: number;
  pageSize?: number;
  search?: string;
  projectId?: string[];
  status?: ProjectTaskStatus[];
  dateFrom?: string;
  dateTo?: string;
  includeCompleted?: boolean;
};

export type MyWorkFilters = {
  page: number;
  pageSize: number;
  search?: string;
  projectIds: string[];
  statuses: ProjectTaskStatus[];
  dateFrom?: string;
  dateTo?: string;
  includeCompleted: boolean;
  today: string;
  weekEnd: string;
};

export type MyWorkTaskGroup =
  "overdue" | "today" | "this_week" | "future" | "undated" | "completed";

export type MyWorkTask = {
  id: string;
  title: string;
  status: ProjectTaskStatus;
  plannedStartDate: string | null;
  internalDueDate: string | null;
  updatedAt: Date;
  group: MyWorkTaskGroup;
  project: { id: string; name: string; client: { id: string; name: string } };
  stage: { id: string; name: string; position: number };
  responsibles: TaskResponsibleRecord[];
};

export type MyWorkPagination = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export type MyAssignedTasksResult = {
  today: string;
  tasks: MyWorkTask[];
  pagination: MyWorkPagination;
};

export type MySupervisedProject = {
  id: string;
  name: string;
  client: { id: string; name: string };
  startDate: string;
  endDate: string;
  counts: {
    pending: number;
    inProgress: number;
    blocked: number;
    completed: number;
    unassigned: number;
    total: number;
  };
  attentionTasks: MyWorkTask[];
};

export type MySupervisionResult = {
  today: string;
  projects: MySupervisedProject[];
  pagination: MyWorkPagination;
};

export type MyCaseActionQuery = {
  page?: number;
  pageSize?: number;
  search?: string;
  clientId?: string[];
  caseId?: string[];
  type?: ("administrative" | "judicial" | "constitutional" | "other")[];
  includeCompleted?: boolean;
};

export type MyCaseActionFilters = {
  page: number;
  pageSize: number;
  search?: string;
  clientIds: string[];
  caseIds: string[];
  types: ("administrative" | "judicial" | "constitutional" | "other")[];
  includeCompleted: boolean;
};

export type MyCaseAction = {
  id: string;
  description: string;
  status: "pending" | "completed";
  updatedAt: Date;
  completedAt: Date | null;
  case: {
    id: string;
    identification: string;
    type: "administrative" | "judicial" | "constitutional" | "other" | null;
    client: { id: string; name: string };
  };
};

export type MyCaseActionsResult = {
  actions: MyCaseAction[];
  pagination: MyWorkPagination;
};
