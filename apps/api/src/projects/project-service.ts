import type {
  CreateProjectInput,
  InitialProjectStage,
  ProjectActor,
  ProjectClientSummary,
  ProjectDates,
  ProjectFilters,
  ProjectGroupedListResult,
  ProjectListItemRecord,
  ProjectListFilters,
  ProjectPatchValues,
  ProjectRecord,
  ProjectValues,
  InitialLegalEventValues,
  InitialProjectAssignment,
  UpdateProjectInput,
} from "./project-types";
import { getDefaultProjectStages } from "./project-stage-defaults";

export type ProjectServiceErrorCode =
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CLIENT_NOT_FOUND"
  | "MEMBER_NOT_FOUND"
  | "INVALID_DATES"
  | "PROJECT_ARCHIVED"
  | "PROJECT_ARCHIVE_CONFLICT";

export class ProjectServiceError extends Error {
  readonly code: ProjectServiceErrorCode;

  constructor(code: ProjectServiceErrorCode, message: string) {
    super(message);
    this.name = "ProjectServiceError";
    this.code = code;
  }
}

export type ProjectStore = {
  hasMembership(userId: string, organizationId: string): Promise<boolean>;
  findClient(
    organizationId: string,
    clientId: string,
  ): Promise<ProjectClientSummary | null>;
  list(
    organizationId: string,
    filters: ProjectListFilters,
  ): Promise<{ projects: ProjectListItemRecord[]; total: number }>;
  listGroupedByClient(
    organizationId: string,
    filters: ProjectListFilters,
  ): Promise<ProjectGroupedListResult>;
  get(organizationId: string, projectId: string): Promise<ProjectRecord | null>;
  create(
    actor: ProjectActor,
    projectId: string,
    values: ProjectValues,
    initialStages: InitialProjectStage[],
    initialLegalEvents: InitialLegalEventValues[],
    initialAssignments: InitialProjectAssignment[],
  ): Promise<
    | { status: "created"; project: ProjectRecord }
    | { status: "forbidden" | "client_not_found" | "member_not_found" }
  >;
  update(
    actor: ProjectActor,
    projectId: string,
    values: ProjectPatchValues,
  ): Promise<
    | { status: "updated" | "unchanged"; project: ProjectRecord }
    | {
        status:
          | "forbidden"
          | "not_found"
          | "project_archived"
          | "invalid_task_start"
          | "invalid_event_start"
          | "invalid_dates"
          | "client_not_found";
      }
  >;
  archive(
    actor: ProjectActor,
    projectId: string,
  ): Promise<
    | { status: "updated"; project: ProjectRecord }
    | { status: "forbidden" | "not_found" | "archive_conflict" }
  >;
  restore(
    actor: ProjectActor,
    projectId: string,
  ): Promise<
    | { status: "updated"; project: ProjectRecord }
    | { status: "forbidden" | "not_found" | "archive_conflict" }
  >;
};

function normalizeOptional(value: string | null | undefined) {
  if (value === undefined || value === null) return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function uniqueValues<Value extends string>(values?: Value[]) {
  if (!values) return undefined;
  const normalized = [
    ...new Set(values.map((value) => value.trim() as Value)),
  ].filter(Boolean);
  return normalized.length > 0 ? normalized : undefined;
}

function assertDates(dates: ProjectDates) {
  if (dates.startDate > dates.endDate) {
    throw new ProjectServiceError(
      "INVALID_DATES",
      "Revisa el orden de las fechas del proyecto.",
    );
  }
}

function normalizeCreateInput(input: CreateProjectInput): ProjectValues {
  return {
    clientId: input.clientId.trim(),
    name: input.name.trim(),
    type: input.type,
    status: input.status ?? "draft",
    startDate: input.startDate,
    endDate: input.endDate,
    internalReference: normalizeOptional(input.internalReference),
    description: normalizeOptional(input.description),
  };
}

function normalizeUpdateInput(input: UpdateProjectInput): ProjectPatchValues {
  const values: ProjectPatchValues = {};

  if (input.clientId !== undefined) values.clientId = input.clientId.trim();
  if (input.name !== undefined) values.name = input.name.trim();
  if (input.type !== undefined) values.type = input.type;
  if (input.status !== undefined) values.status = input.status;
  if (input.startDate !== undefined) values.startDate = input.startDate;
  if (input.endDate !== undefined) values.endDate = input.endDate;
  if (input.internalReference !== undefined) {
    values.internalReference = normalizeOptional(input.internalReference);
  }
  if (input.description !== undefined) {
    values.description = normalizeOptional(input.description);
  }

  return values;
}

export function createProjectService(
  store: ProjectStore,
  createId: () => string = () => crypto.randomUUID(),
) {
  async function assertMembership(actor: ProjectActor) {
    if (!(await store.hasMembership(actor.userId, actor.organizationId))) {
      throw new ProjectServiceError(
        "FORBIDDEN",
        "No tienes acceso a este estudio.",
      );
    }
  }

  async function assertClient(organizationId: string, clientId: string) {
    const client = await store.findClient(organizationId, clientId);
    if (!client) {
      throw new ProjectServiceError(
        "CLIENT_NOT_FOUND",
        "Cliente no disponible.",
      );
    }
  }

  return {
    async list(actor: ProjectActor, filters: ProjectFilters) {
      await assertMembership(actor);
      const page = filters.page ?? 1;
      const pageSize = filters.pageSize ?? 25;
      const view = filters.view;
      const orderBy =
        filters.orderBy ?? (view === "archived" ? "archivedAt" : "endDate");
      const result = await store.list(actor.organizationId, {
        search: filters.search?.trim() || undefined,
        types: uniqueValues(filters.type),
        statuses: uniqueValues(filters.status),
        clientIds: uniqueValues(filters.client),
        memberUserIds: uniqueValues(filters.member),
        view,
        orderBy,
        order:
          filters.order ??
          (filters.orderBy === undefined &&
          (view === "archived" || view === "completed")
            ? "desc"
            : "asc"),
        page,
        pageSize,
      });

      return {
        projects: result.projects,
        pagination: {
          page,
          pageSize,
          total: result.total,
          totalPages:
            result.total === 0 ? 0 : Math.ceil(result.total / pageSize),
        },
      };
    },

    async listGroupedByClient(actor: ProjectActor, filters: ProjectFilters) {
      await assertMembership(actor);
      const page = filters.page ?? 1;
      const pageSize = filters.pageSize ?? 10;
      const view = filters.view;
      const orderBy =
        filters.orderBy ?? (view === "archived" ? "archivedAt" : "endDate");
      const result = await store.listGroupedByClient(actor.organizationId, {
        search: filters.search?.trim() || undefined,
        types: uniqueValues(filters.type),
        statuses: uniqueValues(filters.status),
        clientIds: uniqueValues(filters.client),
        memberUserIds: uniqueValues(filters.member),
        view,
        orderBy,
        order:
          filters.order ??
          (filters.orderBy === undefined &&
          (view === "archived" || view === "completed")
            ? "desc"
            : "asc"),
        page,
        pageSize,
      });

      return {
        groups: result.groups,
        pagination: {
          page,
          pageSize,
          total: result.clientTotal,
          totalPages:
            result.clientTotal === 0
              ? 0
              : Math.ceil(result.clientTotal / pageSize),
        },
        projectTotal: result.projectTotal,
      };
    },

    async get(actor: ProjectActor, projectId: string) {
      await assertMembership(actor);
      const result = await store.get(actor.organizationId, projectId);
      if (!result) {
        throw new ProjectServiceError("NOT_FOUND", "Proyecto no encontrado.");
      }
      return result;
    },

    async create(actor: ProjectActor, input: CreateProjectInput) {
      await assertMembership(actor);
      const values = normalizeCreateInput(input);
      assertDates(values);
      const requestedInitialLegalEvents =
        input.initialLegalEvents ??
        (input.initialLegalEvent ? [input.initialLegalEvent] : []);
      const initialLegalEvents = requestedInitialLegalEvents.map((event) => ({
        title: event.title?.trim() || "Fecha legal",
        date: event.date,
        description: normalizeOptional(event.description),
      }));
      if (initialLegalEvents.some((event) => event.date < values.startDate)) {
        throw new ProjectServiceError(
          "INVALID_DATES",
          "El evento no puede ser anterior al inicio del proyecto.",
        );
      }
      await assertClient(actor.organizationId, values.clientId);

      const projectId = createId();
      const initialStages = getDefaultProjectStages(values.type).map(
        ({ name, description }, position) => ({
          id: createId(),
          name,
          description,
          position,
        }),
      );

      const result = await store.create(
        actor,
        projectId,
        values,
        initialStages,
        initialLegalEvents,
        input.initialAssignments ?? [],
      );
      if (result.status === "forbidden") {
        throw new ProjectServiceError(
          "FORBIDDEN",
          "No tienes acceso a este estudio.",
        );
      }
      if (result.status === "client_not_found") {
        throw new ProjectServiceError(
          "CLIENT_NOT_FOUND",
          "Cliente no disponible.",
        );
      }
      if (result.status === "member_not_found") {
        throw new ProjectServiceError(
          "MEMBER_NOT_FOUND",
          "Uno o más integrantes ya no están disponibles en el estudio.",
        );
      }
      if (!("project" in result)) throw new Error("Unexpected create result");
      return result.project;
    },

    async update(
      actor: ProjectActor,
      projectId: string,
      input: UpdateProjectInput,
    ) {
      await assertMembership(actor);
      const values = normalizeUpdateInput(input);
      if (values.clientId) {
        await assertClient(actor.organizationId, values.clientId);
      }

      const result = await store.update(actor, projectId, values);
      if (result.status === "forbidden") {
        throw new ProjectServiceError(
          "FORBIDDEN",
          "No tienes acceso a este estudio.",
        );
      }
      if (result.status === "not_found") {
        throw new ProjectServiceError("NOT_FOUND", "Proyecto no encontrado.");
      }
      if (result.status === "project_archived") {
        throw new ProjectServiceError(
          "PROJECT_ARCHIVED",
          "El proyecto está archivado. Restáuralo para realizar cambios.",
        );
      }
      if (result.status === "invalid_task_start") {
        throw new ProjectServiceError(
          "INVALID_DATES",
          "El inicio del proyecto no puede ser posterior al inicio planificado de una tarea activa.",
        );
      }
      if (result.status === "invalid_event_start") {
        throw new ProjectServiceError(
          "INVALID_DATES",
          "El inicio del proyecto no puede ser posterior a la fecha de un evento.",
        );
      }
      if (result.status === "invalid_dates") {
        throw new ProjectServiceError(
          "INVALID_DATES",
          "Revisa el orden de las fechas del proyecto.",
        );
      }
      if (result.status === "client_not_found") {
        throw new ProjectServiceError(
          "CLIENT_NOT_FOUND",
          "Cliente no disponible.",
        );
      }
      if (!("project" in result)) throw new Error("Unexpected update result");
      return result.project;
    },

    async archive(actor: ProjectActor, projectId: string) {
      await assertMembership(actor);
      const result = await store.archive(actor, projectId);
      if (result.status === "forbidden") {
        throw new ProjectServiceError(
          "FORBIDDEN",
          "No tienes acceso a este estudio.",
        );
      }
      if (result.status === "not_found") {
        throw new ProjectServiceError("NOT_FOUND", "Proyecto no encontrado.");
      }
      if (result.status === "archive_conflict") {
        throw new ProjectServiceError(
          "PROJECT_ARCHIVE_CONFLICT",
          "El proyecto ya está archivado.",
        );
      }
      if (!("project" in result)) throw new Error("Unexpected archive result");
      return result.project;
    },

    async restore(actor: ProjectActor, projectId: string) {
      await assertMembership(actor);
      const result = await store.restore(actor, projectId);
      if (result.status === "forbidden") {
        throw new ProjectServiceError(
          "FORBIDDEN",
          "No tienes acceso a este estudio.",
        );
      }
      if (result.status === "not_found") {
        throw new ProjectServiceError("NOT_FOUND", "Proyecto no encontrado.");
      }
      if (result.status === "archive_conflict") {
        throw new ProjectServiceError(
          "PROJECT_ARCHIVE_CONFLICT",
          "El proyecto no está archivado.",
        );
      }
      if (!("project" in result)) throw new Error("Unexpected restore result");
      return result.project;
    },
  };
}

export type ProjectService = ReturnType<typeof createProjectService>;
