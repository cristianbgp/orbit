import { calendarDateInTimeZone } from "../organizations/organization-time-zone";
import type {
  MyAssignedTasksResult,
  MySupervisionResult,
  MyWorkActor,
  MyWorkFilters,
  MyWorkQuery,
  MyCaseActionFilters,
  MyCaseActionQuery,
  MyCaseActionsResult,
} from "./my-work-types";

export class MyWorkServiceError extends Error {
  readonly code: "FORBIDDEN";
  constructor(code: "FORBIDDEN", message: string) {
    super(message);
    this.name = "MyWorkServiceError";
    this.code = code;
  }
}

export type MyWorkStore = {
  findMemberContext(
    userId: string,
    organizationId: string,
  ): Promise<{ timeZone: string } | null>;
  listAssignedTasks(
    organizationId: string,
    userId: string,
    filters: MyWorkFilters,
  ): Promise<MyAssignedTasksResult>;
  listSupervisedProjects(
    organizationId: string,
    userId: string,
    filters: MyWorkFilters & { previewLimit: number },
  ): Promise<MySupervisionResult>;
  listAssignedCaseActions(
    organizationId: string,
    userId: string,
    filters: MyCaseActionFilters,
  ): Promise<MyCaseActionsResult>;
};

function addCalendarDays(date: string, days: number) {
  const instant = new Date(`${date}T00:00:00.000Z`);
  instant.setUTCDate(instant.getUTCDate() + days);
  return instant.toISOString().slice(0, 10);
}

function endOfCalendarWeek(date: string) {
  const day = new Date(`${date}T00:00:00.000Z`).getUTCDay();
  return addCalendarDays(date, (7 - day) % 7);
}

function unique<T>(values: T[] | undefined) {
  return [...new Set(values ?? [])];
}

function normalize(query: MyWorkQuery, today: string): MyWorkFilters {
  const search = query.search?.trim();
  return {
    page: query.page ?? 1,
    pageSize: query.pageSize ?? 25,
    search: search || undefined,
    projectIds: unique(query.projectId),
    statuses: unique(query.status),
    dateFrom: query.dateFrom,
    dateTo: query.dateTo,
    includeCompleted: query.includeCompleted ?? false,
    today,
    weekEnd: endOfCalendarWeek(today),
  };
}

function normalizeCaseActions(query: MyCaseActionQuery): MyCaseActionFilters {
  const search = query.search?.trim();
  return {
    page: query.page ?? 1,
    pageSize: query.pageSize ?? 25,
    search: search || undefined,
    clientIds: unique(query.clientId),
    caseIds: unique(query.caseId),
    types: unique(query.type),
    includeCompleted: query.includeCompleted ?? false,
  };
}

export function createMyWorkService(
  store: MyWorkStore,
  now: () => Date = () => new Date(),
) {
  async function context(actor: MyWorkActor) {
    const membership = await store.findMemberContext(
      actor.userId,
      actor.organizationId,
    );
    if (!membership)
      throw new MyWorkServiceError(
        "FORBIDDEN",
        "No tienes acceso a este estudio.",
      );
    const today = calendarDateInTimeZone(now(), membership.timeZone);
    return { today, filters: (query: MyWorkQuery) => normalize(query, today) };
  }

  return {
    async assignedTasks(actor: MyWorkActor, query: MyWorkQuery) {
      const { filters } = await context(actor);
      return store.listAssignedTasks(
        actor.organizationId,
        actor.userId,
        filters(query),
      );
    },
    async supervision(actor: MyWorkActor, query: MyWorkQuery) {
      const { filters } = await context(actor);
      return store.listSupervisedProjects(actor.organizationId, actor.userId, {
        ...filters(query),
        previewLimit: 5,
      });
    },
    async caseActions(actor: MyWorkActor, query: MyCaseActionQuery) {
      await context(actor);
      return store.listAssignedCaseActions(
        actor.organizationId,
        actor.userId,
        normalizeCaseActions(query),
      );
    },
  };
}

export type MyWorkService = ReturnType<typeof createMyWorkService>;
