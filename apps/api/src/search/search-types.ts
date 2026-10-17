import type { ClientType } from "../clients/client-types";
import type { CaseStatus, CaseType } from "../cases/case-types";
import type { ProjectTaskStatus } from "../project-tasks/project-task-types";
import type { ProjectStatus } from "../projects/project-types";

export type SearchAccessScope = {
  userId: string;
  organizationId: string;
};

export type ProjectSearchResult = {
  id: string;
  name: string;
  status: ProjectStatus;
  client: { id: string; name: string };
};

export type CaseSearchResult = {
  id: string;
  identification: string;
  status: CaseStatus;
  type: CaseType | null;
  client: { id: string; name: string };
};

export type TaskSearchResult = {
  id: string;
  title: string;
  status: ProjectTaskStatus;
  project: { id: string; name: string };
  client: { id: string; name: string };
  stage: { id: string; name: string };
};

export type ClientSearchResult = {
  id: string;
  name: string;
  type: ClientType;
  documentNumber: string | null;
};

export type MemberSearchResult = {
  userId: string;
  alias: string;
  avatarColor: string;
  name: string;
  email: string;
  role: string;
};

export type GlobalSearchResult = {
  cases: CaseSearchResult[];
  projects: ProjectSearchResult[];
  tasks: TaskSearchResult[];
  clients: ClientSearchResult[];
  members: MemberSearchResult[];
};

export type SearchStore = {
  hasMembership(userId: string, organizationId: string): Promise<boolean>;
  search(
    scope: SearchAccessScope,
    query: string,
    limit: number,
  ): Promise<GlobalSearchResult>;
};

export type SearchService = {
  search(
    actor: SearchAccessScope,
    input: { q: string; limit: number },
  ): Promise<GlobalSearchResult>;
};
