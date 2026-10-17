import type {
  ActiveProjectTaskMember,
  CreateProjectTaskInput,
  ProjectTaskActor,
  ProjectTaskCreateValues,
  ProjectTaskCalendarFilters,
  ProjectTaskCalendarInput,
  ProjectTaskCalendarResult,
  ProjectTaskListInput,
  ProjectTaskMutationResult,
  ProjectTaskPatchValues,
  ProjectTaskRecord,
  ProjectTaskResponsiblesValues,
  ProjectTaskScheduleRecord,
  ProjectTaskStateValues,
  ProjectTaskStatus,
  ProjectTaskUpdateValues,
  ProjectTaskView,
  UpdateProjectTaskInput,
  UndatedProjectTaskFilters,
  UndatedProjectTaskInput,
  UndatedProjectTaskResult,
} from "./project-task-types";
import { calendarDateInTimeZone } from "../organizations/organization-time-zone";

export type ProjectTaskServiceErrorCode =
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "VALIDATION_ERROR"
  | "CONFLICT"
  | "PROJECT_ARCHIVED";

export class ProjectTaskServiceError extends Error {
  readonly code: ProjectTaskServiceErrorCode;

  constructor(code: ProjectTaskServiceErrorCode, message: string) {
    super(message);
    this.name = "ProjectTaskServiceError";
    this.code = code;
  }
}

export type ProjectTaskStore = {
  findActiveMember(
    userId: string,
    organizationId: string,
  ): Promise<ActiveProjectTaskMember | null>;
  find(
    organizationId: string,
    projectId: string,
    taskId: string,
  ): Promise<ProjectTaskRecord | null>;
  list(
    organizationId: string,
    projectId: string,
    input: {
      view: ProjectTaskView;
      page: number;
      pageSize: number;
      stageId?: string;
    },
  ): Promise<{
    projectExists: boolean;
    tasks: ProjectTaskRecord[];
    total: number;
  }>;
  calendar(
    organizationId: string,
    filters: ProjectTaskCalendarFilters,
  ): Promise<ProjectTaskCalendarResult>;
  listUndated(
    organizationId: string,
    filters: UndatedProjectTaskFilters,
  ): Promise<UndatedProjectTaskResult>;
  schedule(
    organizationId: string,
    projectId: string,
  ): Promise<
    | { projectExists: false; schedule: null }
    | { projectExists: true; schedule: ProjectTaskScheduleRecord }
  >;
  create(values: ProjectTaskCreateValues): Promise<ProjectTaskMutationResult>;
  update(values: ProjectTaskUpdateValues): Promise<ProjectTaskMutationResult>;
  replaceResponsibles(
    values: ProjectTaskResponsiblesValues,
  ): Promise<ProjectTaskMutationResult>;
  archive(values: ProjectTaskStateValues): Promise<ProjectTaskMutationResult>;
  restore(values: ProjectTaskStateValues): Promise<ProjectTaskMutationResult>;
};

function normalizeOptionalText(value: string | null | undefined) {
  if (value === null || value === undefined) return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function assertDistinct(ids: string[]) {
  if (new Set(ids).size !== ids.length) {
    throw new ProjectTaskServiceError(
      "VALIDATION_ERROR",
      "No repitas encargados en una tarea.",
    );
  }
}

function distinct<T>(values: T[]) {
  return [...new Set(values)];
}

function assertTaskDates(
  plannedStartDate: string | null | undefined,
  internalDueDate: string | null | undefined,
  requireStartForDeadline = false,
) {
  if (
    internalDueDate &&
    (plannedStartDate === null ||
      (requireStartForDeadline && plannedStartDate === undefined))
  ) {
    throw new ProjectTaskServiceError(
      "VALIDATION_ERROR",
      "Selecciona un inicio planificado para usar una fecha límite.",
    );
  }
  if (
    plannedStartDate &&
    internalDueDate &&
    plannedStartDate > internalDueDate
  ) {
    throw new ProjectTaskServiceError(
      "VALIDATION_ERROR",
      "El inicio planificado no puede ser posterior a la fecha límite.",
    );
  }
}

function taskFromResult(result: ProjectTaskMutationResult) {
  if (result.status === "created" || result.status === "updated") {
    return result.task;
  }
  if (result.status === "not_found") {
    throw new ProjectTaskServiceError("NOT_FOUND", "Tarea no encontrada.");
  }
  if (result.status === "invalid_responsibles") {
    throw new ProjectTaskServiceError(
      "CONFLICT",
      "Los encargados deben pertenecer al equipo actual del proyecto.",
    );
  }
  if (result.status === "invalid_dates") {
    throw new ProjectTaskServiceError(
      "VALIDATION_ERROR",
      "Revisa las fechas planificadas de la tarea.",
    );
  }
  if (result.status === "project_archived") {
    throw new ProjectTaskServiceError(
      "PROJECT_ARCHIVED",
      "El proyecto está archivado. Restáuralo para realizar cambios.",
    );
  }
  throw new ProjectTaskServiceError(
    "CONFLICT",
    "La tarea cambió mientras la editabas. Actualiza e inténtalo nuevamente.",
  );
}

function automaticStartForStatus(
  status: ProjectTaskStatus | undefined,
  member: ActiveProjectTaskMember,
  now: () => Date,
) {
  if (status !== "in_progress" && status !== "completed") return undefined;
  return calendarDateInTimeZone(now(), member.organizationTimeZone);
}

export function createProjectTaskService(
  store: ProjectTaskStore,
  createId: () => string = () => crypto.randomUUID(),
  now: () => Date = () => new Date(),
) {
  async function activeActor(actor: ProjectTaskActor) {
    const member = await store.findActiveMember(
      actor.userId,
      actor.organizationId,
    );
    if (!member) {
      throw new ProjectTaskServiceError(
        "FORBIDDEN",
        "No tienes acceso a este estudio.",
      );
    }
    return member;
  }

  return {
    async get(actor: ProjectTaskActor, projectId: string, taskId: string) {
      await activeActor(actor);
      const task = await store.find(actor.organizationId, projectId, taskId);
      if (!task) {
        throw new ProjectTaskServiceError("NOT_FOUND", "Tarea no encontrada.");
      }
      return task;
    },

    async list(
      actor: ProjectTaskActor,
      projectId: string,
      input: ProjectTaskListInput,
    ) {
      await activeActor(actor);
      const view = input.view ?? "active";
      const page = input.page ?? 1;
      const pageSize = input.pageSize ?? 25;
      const result = await store.list(actor.organizationId, projectId, {
        view,
        page,
        pageSize,
        stageId: input.stageId,
      });
      if (!result.projectExists) {
        throw new ProjectTaskServiceError(
          "NOT_FOUND",
          "Proyecto no encontrado.",
        );
      }
      return {
        tasks: result.tasks,
        pagination: {
          page,
          pageSize,
          total: result.total,
          totalPages:
            result.total === 0 ? 0 : Math.ceil(result.total / pageSize),
        },
      };
    },

    async calendar(actor: ProjectTaskActor, input: ProjectTaskCalendarInput) {
      const member = await activeActor(actor);
      return store.calendar(actor.organizationId, {
        ...input,
        projectIds: distinct(input.projectIds),
        responsibleUserIds: distinct(input.responsibleUserIds),
        statuses: distinct(input.statuses),
        search: input.search?.trim() || undefined,
        today: calendarDateInTimeZone(now(), member.organizationTimeZone),
      });
    },

    async listUndated(actor: ProjectTaskActor, input: UndatedProjectTaskInput) {
      const member = await activeActor(actor);
      const page = input.page ?? 1;
      const pageSize = input.pageSize ?? 25;
      const result = await store.listUndated(actor.organizationId, {
        ...input,
        projectIds: distinct(input.projectIds),
        responsibleUserIds: distinct(input.responsibleUserIds),
        statuses: distinct(input.statuses),
        search: input.search?.trim() || undefined,
        page,
        pageSize,
        today: calendarDateInTimeZone(now(), member.organizationTimeZone),
      });
      return {
        tasks: result.tasks,
        pagination: {
          page,
          pageSize,
          total: result.total,
          totalPages:
            result.total === 0 ? 0 : Math.ceil(result.total / pageSize),
        },
      };
    },

    async schedule(actor: ProjectTaskActor, projectId: string) {
      await activeActor(actor);
      const result = await store.schedule(actor.organizationId, projectId);
      if (!result.projectExists) {
        throw new ProjectTaskServiceError(
          "NOT_FOUND",
          "Proyecto no encontrado.",
        );
      }
      return result.schedule;
    },

    async create(
      actor: ProjectTaskActor,
      projectId: string,
      input: CreateProjectTaskInput,
    ) {
      const member = await activeActor(actor);
      const responsibleUserIds = input.responsibleUserIds ?? [];
      assertDistinct(responsibleUserIds);
      const automaticPlannedStartDate = automaticStartForStatus(
        input.status,
        member,
        now,
      );
      assertTaskDates(
        input.plannedStartDate ?? automaticPlannedStartDate,
        input.internalDueDate,
        true,
      );
      return taskFromResult(
        await store.create({
          actor: member,
          id: createId(),
          projectId,
          stageId: input.stageId,
          title: input.title.trim(),
          description: normalizeOptionalText(input.description),
          status: input.status ?? "pending",
          ...(automaticPlannedStartDate ? { automaticPlannedStartDate } : {}),
          plannedStartDate: input.plannedStartDate ?? null,
          internalDueDate: input.internalDueDate ?? null,
          responsibleUserIds,
        }),
      );
    },

    async update(
      actor: ProjectTaskActor,
      projectId: string,
      taskId: string,
      input: UpdateProjectTaskInput,
    ) {
      const member = await activeActor(actor);
      const values: ProjectTaskPatchValues = {};
      if (input.title !== undefined) values.title = input.title.trim();
      if (input.stageId !== undefined) values.stageId = input.stageId;
      if (input.description !== undefined) {
        values.description = normalizeOptionalText(input.description);
      }
      if (input.status !== undefined) values.status = input.status;
      const automaticPlannedStartDate = automaticStartForStatus(
        input.status,
        member,
        now,
      );
      if (automaticPlannedStartDate) {
        values.automaticPlannedStartDate = automaticPlannedStartDate;
      }
      if (input.plannedStartDate !== undefined) {
        values.plannedStartDate = input.plannedStartDate;
      }
      if (input.internalDueDate !== undefined) {
        values.internalDueDate = input.internalDueDate;
      }
      const plannedStartForValidation =
        input.plannedStartDate !== undefined
          ? (input.plannedStartDate ?? automaticPlannedStartDate ?? null)
          : automaticPlannedStartDate;
      assertTaskDates(plannedStartForValidation, input.internalDueDate);
      return taskFromResult(
        await store.update({ actor: member, projectId, taskId, values }),
      );
    },

    async replaceResponsibles(
      actor: ProjectTaskActor,
      projectId: string,
      taskId: string,
      responsibleUserIds: string[],
    ) {
      const member = await activeActor(actor);
      assertDistinct(responsibleUserIds);
      return taskFromResult(
        await store.replaceResponsibles({
          actor: member,
          projectId,
          taskId,
          responsibleUserIds,
        }),
      );
    },

    async archive(actor: ProjectTaskActor, projectId: string, taskId: string) {
      const member = await activeActor(actor);
      return taskFromResult(
        await store.archive({ actor: member, projectId, taskId }),
      );
    },

    async restore(actor: ProjectTaskActor, projectId: string, taskId: string) {
      const member = await activeActor(actor);
      return taskFromResult(
        await store.restore({ actor: member, projectId, taskId }),
      );
    },
  };
}

export type ProjectTaskService = ReturnType<typeof createProjectTaskService>;
export type { ProjectTaskRecord };
