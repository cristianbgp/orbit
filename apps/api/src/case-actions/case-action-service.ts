import type {
  CaseActionActor,
  CaseActionListStatus,
  CaseActionRecord,
  CaseActionValues,
  CreateCaseActionInput,
  UpdateCaseActionInput,
} from "./case-action-types";

type MutationFailure =
  | "forbidden"
  | "not_found"
  | "case_archived"
  | "conflict"
  | "assignee_not_found";
type MutationResult =
  | { status: "updated" | "unchanged"; action: CaseActionRecord }
  | { status: MutationFailure };

export type CaseActionStore = {
  hasMembership(userId: string, organizationId: string): Promise<boolean>;
  list(
    organizationId: string,
    caseId: string,
    input: { status: CaseActionListStatus; page: number; pageSize: number },
  ): Promise<{ actions: CaseActionRecord[]; total: number } | null>;
  create(
    actor: CaseActionActor,
    caseId: string,
    actionId: string,
    values: CaseActionValues,
  ): Promise<
    | { status: "created"; action: CaseActionRecord }
    | { status: MutationFailure }
  >;
  update(
    actor: CaseActionActor,
    caseId: string,
    actionId: string,
    values: Partial<CaseActionValues>,
    expectedUpdatedAt: string,
  ): Promise<MutationResult>;
  complete(
    actor: CaseActionActor,
    caseId: string,
    actionId: string,
    expectedUpdatedAt: string,
  ): Promise<MutationResult>;
  reopen(
    actor: CaseActionActor,
    caseId: string,
    actionId: string,
    expectedUpdatedAt: string,
  ): Promise<MutationResult>;
  archive(
    actor: CaseActionActor,
    caseId: string,
    actionId: string,
    expectedUpdatedAt: string,
  ): Promise<MutationResult>;
  restore(
    actor: CaseActionActor,
    caseId: string,
    actionId: string,
    expectedUpdatedAt: string,
  ): Promise<MutationResult>;
};

export type CaseActionServiceErrorCode =
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "VALIDATION_ERROR"
  | "CASE_ARCHIVED"
  | "CONFLICT"
  | "ASSIGNEE_NOT_FOUND";
export class CaseActionServiceError extends Error {
  constructor(
    readonly code: CaseActionServiceErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "CaseActionServiceError";
  }
}

function description(value: string) {
  const normalized = value.trim();
  if (!normalized || normalized.length > 1_000)
    throw new CaseActionServiceError(
      "VALIDATION_ERROR",
      "La descripción debe tener entre 1 y 1000 caracteres.",
    );
  return normalized;
}

function version(value: string) {
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime()))
    throw new CaseActionServiceError(
      "VALIDATION_ERROR",
      "La versión de la acción no es válida.",
    );
  return parsed.toISOString();
}

function fail(status: MutationFailure): never {
  if (status === "forbidden")
    throw new CaseActionServiceError(
      "FORBIDDEN",
      "No tienes acceso a este estudio.",
    );
  if (status === "case_archived")
    throw new CaseActionServiceError(
      "CASE_ARCHIVED",
      "El caso está archivado. Restáuralo para realizar cambios.",
    );
  if (status === "conflict")
    throw new CaseActionServiceError(
      "CONFLICT",
      "La acción cambió mientras la editabas. Actualiza e inténtalo nuevamente.",
    );
  if (status === "assignee_not_found")
    throw new CaseActionServiceError(
      "ASSIGNEE_NOT_FOUND",
      "El encargado debe pertenecer al equipo activo del caso.",
    );
  throw new CaseActionServiceError("NOT_FOUND", "Acción no encontrada.");
}

export function createCaseActionService(
  store: CaseActionStore,
  createId: () => string = () => crypto.randomUUID(),
) {
  async function member(actor: CaseActionActor) {
    if (!(await store.hasMembership(actor.userId, actor.organizationId)))
      fail("forbidden");
  }
  function result(value: MutationResult) {
    if (value.status !== "updated" && value.status !== "unchanged")
      fail(value.status);
    return value.action;
  }
  return {
    async list(
      actor: CaseActionActor,
      caseId: string,
      input: {
        status?: CaseActionListStatus;
        page?: number;
        pageSize?: number;
      },
    ) {
      await member(actor);
      const page = input.page ?? 1;
      const pageSize = input.pageSize ?? 10;
      const found = await store.list(actor.organizationId, caseId, {
        status: input.status ?? "pending",
        page,
        pageSize,
      });
      if (!found) fail("not_found");
      return {
        actions: found.actions,
        pagination: {
          page,
          pageSize,
          total: found.total,
          totalPages: found.total ? Math.ceil(found.total / pageSize) : 0,
        },
      };
    },
    async create(
      actor: CaseActionActor,
      caseId: string,
      input: CreateCaseActionInput,
    ) {
      await member(actor);
      const created = await store.create(actor, caseId, createId(), {
        description: description(input.description),
        assigneeUserId: input.assigneeUserId ?? null,
      });
      if (created.status !== "created") fail(created.status);
      return created.action;
    },
    async update(
      actor: CaseActionActor,
      caseId: string,
      actionId: string,
      input: UpdateCaseActionInput,
    ) {
      await member(actor);
      const values: Partial<CaseActionValues> = {};
      if (input.description !== undefined)
        values.description = description(input.description);
      if (Object.prototype.hasOwnProperty.call(input, "assigneeUserId"))
        values.assigneeUserId = input.assigneeUserId ?? null;
      return result(
        await store.update(
          actor,
          caseId,
          actionId,
          values,
          version(input.expectedUpdatedAt),
        ),
      );
    },
    async complete(
      actor: CaseActionActor,
      caseId: string,
      actionId: string,
      expectedUpdatedAt: string,
    ) {
      await member(actor);
      return result(
        await store.complete(
          actor,
          caseId,
          actionId,
          version(expectedUpdatedAt),
        ),
      );
    },
    async reopen(
      actor: CaseActionActor,
      caseId: string,
      actionId: string,
      expectedUpdatedAt: string,
    ) {
      await member(actor);
      return result(
        await store.reopen(actor, caseId, actionId, version(expectedUpdatedAt)),
      );
    },
    async archive(
      actor: CaseActionActor,
      caseId: string,
      actionId: string,
      expectedUpdatedAt: string,
    ) {
      await member(actor);
      return result(
        await store.archive(
          actor,
          caseId,
          actionId,
          version(expectedUpdatedAt),
        ),
      );
    },
    async restore(
      actor: CaseActionActor,
      caseId: string,
      actionId: string,
      expectedUpdatedAt: string,
    ) {
      await member(actor);
      return result(
        await store.restore(
          actor,
          caseId,
          actionId,
          version(expectedUpdatedAt),
        ),
      );
    },
  };
}

export type CaseActionService = ReturnType<typeof createCaseActionService>;
