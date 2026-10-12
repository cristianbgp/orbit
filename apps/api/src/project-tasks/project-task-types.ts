import type { StudioMemberPosition } from "../identity/studio-member-position";

export type ProjectTaskStatus =
  "pending" | "in_progress" | "blocked" | "completed";

export type ProjectTaskView = "active" | "archived";

export type ProjectTaskActor = {
  userId: string;
  organizationId: string;
};

export type ActiveProjectTaskMember = {
  memberId: string;
  userId: string;
  organizationId: string;
  organizationTimeZone: string;
  name: string;
  email: string;
};

export type TaskResponsibleRecord = {
  assignmentId: string;
  userId: string | null;
  userName: string;
  userEmail: string;
  userAlias: string;
  userAvatarColor: string | null;
  userPosition: StudioMemberPosition | null;
  activeStudioMember: boolean;
  assignedAt: Date;
};

export type ProjectTaskRecord = {
  id: string;
  organizationId: string;
  projectId: string;
  stageId: string;
  stageName: string;
  stagePosition: number;
  title: string;
  description: string | null;
  status: ProjectTaskStatus;
  plannedStartDate: string | null;
  internalDueDate: string | null;
  position: number;
  archivedAt: Date | null;
  responsibles: TaskResponsibleRecord[];
  createdAt: Date;
  updatedAt: Date;
};

export type CreateProjectTaskInput = {
  title: string;
  stageId: string;
  description?: string | null;
  status?: ProjectTaskStatus;
  plannedStartDate?: string | null;
  internalDueDate?: string | null;
  responsibleUserIds?: string[];
};

export type UpdateProjectTaskInput = {
  title?: string;
  stageId?: string;
  description?: string | null;
  status?: ProjectTaskStatus;
  plannedStartDate?: string | null;
  internalDueDate?: string | null;
};

export type ProjectTaskListInput = {
  view?: ProjectTaskView;
  page?: number;
  pageSize?: number;
  stageId?: string;
};

export type ProjectTaskCalendarFilters = {
  from: string;
  to: string;
  projectIds: string[];
  responsibleUserIds: string[];
  statuses: ProjectTaskStatus[];
  search?: string;
  overdueOnly: boolean;
  today: string;
};

export type ProjectTaskCalendarRecord = {
  id: string;
  title: string;
  status: ProjectTaskStatus;
  plannedStartDate: string;
  internalDueDate: string | null;
  position: number;
  project: {
    id: string;
    name: string;
    startDate: string;
    client: { id: string; name: string };
  };
  stage: { id: string; name: string; position: number };
  responsibles: TaskResponsibleRecord[];
};

export type ProjectTaskCalendarMarker = {
  projectId: string;
  projectName: string;
  clientName: string;
  kind: "project_start" | "project_end" | "project_event";
  date: string;
  eventId?: string;
  eventTitle?: string;
  eventType?: "legal" | "meeting" | "other";
};

export type ProjectTaskCalendarResult = {
  tasks: ProjectTaskCalendarRecord[];
  markers: ProjectTaskCalendarMarker[];
  undatedTaskCount: number;
  truncated: boolean;
};

export type ProjectTaskCalendarInput = Omit<
  ProjectTaskCalendarFilters,
  "today"
>;

export type UndatedProjectTaskFilters = Omit<
  ProjectTaskCalendarFilters,
  "from" | "to"
> & {
  page: number;
  pageSize: number;
};

export type UndatedProjectTaskResult = {
  tasks: Array<
    Omit<ProjectTaskCalendarRecord, "plannedStartDate"> & {
      plannedStartDate: null;
    }
  >;
  total: number;
};

export type UndatedProjectTaskInput = Omit<
  UndatedProjectTaskFilters,
  "today" | "page" | "pageSize"
> & {
  page?: number;
  pageSize?: number;
};

export type ProjectTaskCreateValues = {
  actor: ActiveProjectTaskMember;
  id: string;
  projectId: string;
  stageId: string;
  title: string;
  description: string | null;
  status: ProjectTaskStatus;
  automaticPlannedStartDate?: string;
  plannedStartDate: string | null;
  internalDueDate: string | null;
  responsibleUserIds: string[];
};

export type ProjectTaskPatchValues = {
  title?: string;
  stageId?: string;
  description?: string | null;
  status?: ProjectTaskStatus;
  automaticPlannedStartDate?: string;
  plannedStartDate?: string | null;
  internalDueDate?: string | null;
};

export type ProjectTaskUpdateValues = {
  actor: ActiveProjectTaskMember;
  projectId: string;
  taskId: string;
  values: ProjectTaskPatchValues;
};

export type ProjectTaskResponsiblesValues = {
  actor: ActiveProjectTaskMember;
  projectId: string;
  taskId: string;
  responsibleUserIds: string[];
};

export type ProjectTaskStateValues = {
  actor: ActiveProjectTaskMember;
  projectId: string;
  taskId: string;
};

export type ProjectTaskMutationResult =
  | { status: "created" | "updated"; task: ProjectTaskRecord }
  | {
      status:
        | "not_found"
        | "conflict"
        | "invalid_responsibles"
        | "invalid_dates"
        | "project_archived";
    };

export type ProjectTaskScheduleRecord = {
  project: {
    startDate: string;
    endDate: string;
    timeZone: string;
  };
  events: Array<{
    id: string;
    title: string;
    type: "legal" | "meeting" | "other";
    date: string;
  }>;
  stages: Array<{
    id: string;
    name: string;
    position: number;
    startDate: string | null;
    endDate: string | null;
    scheduledTaskCount: number;
    taskStatusCounts: {
      pending: number;
      inProgress: number;
      blocked: number;
      completed: number;
    };
    tasks: Array<{
      id: string;
      title: string;
      status: ProjectTaskStatus;
      plannedStartDate: string | null;
      internalDueDate: string | null;
      position: number;
    }>;
    usesProjectStartFallback: boolean;
  }>;
};
