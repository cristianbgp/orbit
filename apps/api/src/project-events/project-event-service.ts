import type {
  CreateProjectEventInput,
  ProjectEventActor,
  ProjectEventRecord,
  ProjectEventValues,
  UpdateProjectEventInput,
} from "./project-event-types";

export type ProjectEventServiceErrorCode =
  "FORBIDDEN" | "NOT_FOUND" | "VALIDATION_ERROR" | "PROJECT_ARCHIVED";

export class ProjectEventServiceError extends Error {
  constructor(
    readonly code: ProjectEventServiceErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "ProjectEventServiceError";
  }
}

type MutationFailure =
  "forbidden" | "not_found" | "invalid_date" | "project_archived";

export type ProjectEventStore = {
  hasMembership(userId: string, organizationId: string): Promise<boolean>;
  list(
    organizationId: string,
    projectId: string,
    pagination: { page: number; pageSize: number },
  ): Promise<{ events: ProjectEventRecord[]; total: number } | null>;
  create(
    actor: ProjectEventActor,
    projectId: string,
    eventId: string,
    values: ProjectEventValues,
  ): Promise<
    | { status: "created"; event: ProjectEventRecord }
    | { status: MutationFailure }
  >;
  update(
    actor: ProjectEventActor,
    projectId: string,
    eventId: string,
    values: Partial<ProjectEventValues>,
  ): Promise<
    | { status: "updated" | "unchanged"; event: ProjectEventRecord }
    | { status: MutationFailure }
  >;
  remove(
    actor: ProjectEventActor,
    projectId: string,
    eventId: string,
  ): Promise<{ status: "removed" } | { status: MutationFailure }>;
};

function normalizeOptional(value: string | null | undefined) {
  if (value === undefined || value === null) return null;
  return value.trim() || null;
}

function normalizeCreate(input: CreateProjectEventInput): ProjectEventValues {
  return {
    title: input.title.trim(),
    type: "legal",
    date: input.date,
    description: normalizeOptional(input.description),
  };
}

function throwFailure(status: MutationFailure): never {
  if (status === "forbidden") {
    throw new ProjectEventServiceError(
      "FORBIDDEN",
      "No tienes acceso a este estudio.",
    );
  }
  if (status === "project_archived") {
    throw new ProjectEventServiceError(
      "PROJECT_ARCHIVED",
      "El proyecto está archivado. Restáuralo para realizar cambios.",
    );
  }
  if (status === "invalid_date") {
    throw new ProjectEventServiceError(
      "VALIDATION_ERROR",
      "El evento no puede ser anterior al inicio del proyecto.",
    );
  }
  throw new ProjectEventServiceError("NOT_FOUND", "Evento no encontrado.");
}

export function createProjectEventService(
  store: ProjectEventStore,
  createId: () => string = () => crypto.randomUUID(),
) {
  async function assertMembership(actor: ProjectEventActor) {
    if (!(await store.hasMembership(actor.userId, actor.organizationId))) {
      throwFailure("forbidden");
    }
  }

  return {
    async list(
      actor: ProjectEventActor,
      projectId: string,
      query: { page?: number; pageSize?: number },
    ) {
      await assertMembership(actor);
      const page = query.page ?? 1;
      const pageSize = query.pageSize ?? 25;
      const result = await store.list(actor.organizationId, projectId, {
        page,
        pageSize,
      });
      if (!result) throwFailure("not_found");
      return {
        events: result.events,
        pagination: {
          page,
          pageSize,
          total: result.total,
          totalPages:
            result.total === 0 ? 0 : Math.ceil(result.total / pageSize),
        },
      };
    },

    async create(
      actor: ProjectEventActor,
      projectId: string,
      input: CreateProjectEventInput,
    ) {
      await assertMembership(actor);
      const result = await store.create(
        actor,
        projectId,
        createId(),
        normalizeCreate(input),
      );
      if (result.status !== "created") throwFailure(result.status);
      return result.event;
    },

    async update(
      actor: ProjectEventActor,
      projectId: string,
      eventId: string,
      input: UpdateProjectEventInput,
    ) {
      await assertMembership(actor);
      const values: Partial<ProjectEventValues> = {};
      if (input.title !== undefined) values.title = input.title.trim();
      if (input.type !== undefined) values.type = "legal";
      if (input.date !== undefined) values.date = input.date;
      if (input.description !== undefined) {
        values.description = normalizeOptional(input.description);
      }
      const result = await store.update(actor, projectId, eventId, values);
      if (result.status !== "updated" && result.status !== "unchanged") {
        throwFailure(result.status);
      }
      return result.event;
    },

    async remove(actor: ProjectEventActor, projectId: string, eventId: string) {
      await assertMembership(actor);
      const result = await store.remove(actor, projectId, eventId);
      if (result.status !== "removed") throwFailure(result.status);
    },
  };
}

export type ProjectEventService = ReturnType<typeof createProjectEventService>;
