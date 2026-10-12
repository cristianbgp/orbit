export type ProjectType =
  "written_submission" | "consultation" | "oral_argument" | "other";

export type ProjectStatus = "draft" | "active" | "completed";

export type ProjectView = "current" | "completed" | "archived";

export type ProjectOrderBy = "endDate" | "startDate" | "name" | "archivedAt";

export type ProjectOrder = "asc" | "desc";

export type ProjectClientSummary = {
  id: string;
  name: string;
};

export type ProjectActor = {
  userId: string;
  organizationId: string;
};

export type ProjectRecord = {
  id: string;
  organizationId: string;
  clientId: string;
  client: ProjectClientSummary;
  name: string;
  type: ProjectType;
  status: ProjectStatus;
  startDate: string;
  endDate: string;
  internalReference: string | null;
  description: string | null;
  archivedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type ProjectTeamMemberSummary = {
  userId: string;
  fullName: string;
  alias: string;
  avatarColor: string | null;
  responsibility: "responsible" | "member";
  position: StudioMemberPosition | null;
};

export type ProjectTeamSummary = {
  members: ProjectTeamMemberSummary[];
  total: number;
};

export type ProjectListItemRecord = ProjectRecord & {
  team: ProjectTeamSummary;
};

export type OptionalProjectField = string | null | undefined;

export type CreateProjectInput = {
  name: string;
  clientId: string;
  type: ProjectType;
  status?: ProjectStatus;
  startDate: string;
  endDate: string;
  initialLegalEvent?: {
    title?: string;
    date: string;
    description?: OptionalProjectField;
  };
  initialLegalEvents?: Array<{
    title?: string;
    date: string;
    description?: OptionalProjectField;
  }>;
  initialAssignments?: InitialProjectAssignment[];
  internalReference?: OptionalProjectField;
  description?: OptionalProjectField;
};

export type InitialProjectAssignment = {
  userId: string;
  responsibility: "responsible" | "member";
};

export type UpdateProjectInput = Partial<
  Omit<CreateProjectInput, "initialLegalEvent" | "initialLegalEvents">
>;

export type ProjectValues = {
  clientId: string;
  name: string;
  type: ProjectType;
  status: ProjectStatus;
  startDate: string;
  endDate: string;
  internalReference: string | null;
  description: string | null;
};

export type InitialProjectStage = {
  id: string;
  name: string;
  description: string | null;
  position: number;
};

export type ProjectPatchValues = Partial<ProjectValues>;

export type ProjectFilters = {
  search?: string;
  type?: ProjectType[];
  status?: ProjectStatus[];
  client?: string[];
  member?: string[];
  view?: ProjectView;
  orderBy?: ProjectOrderBy;
  order?: ProjectOrder;
  page?: number;
  pageSize?: number;
};

export type ProjectListFilters = {
  search?: string;
  types?: ProjectType[];
  statuses?: ProjectStatus[];
  clientIds?: string[];
  memberUserIds?: string[];
  view?: ProjectView;
  orderBy?: ProjectOrderBy;
  order?: ProjectOrder;
  page: number;
  pageSize: number;
};

export type ProjectPagination = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export type ProjectClientGroup = {
  client: ProjectClientSummary;
  projects: ProjectListItemRecord[];
};

export type ProjectGroupedListResult = {
  groups: ProjectClientGroup[];
  clientTotal: number;
  projectTotal: number;
};

export type ProjectDates = Pick<ProjectValues, "startDate" | "endDate">;

export type InitialLegalEventValues = {
  title: string;
  date: string;
  description: string | null;
};
import type { StudioMemberPosition } from "../identity/studio-member-position";
