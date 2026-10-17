import type {
  CaseUpdateActor,
  CaseUpdateKind,
  CaseUpdateRecord,
  CaseUpdateStatus,
  CaseUpdateValues,
  CreateCaseUpdateInput,
  UpdateCaseUpdateInput,
} from "./case-update-types";

type MutationFailure = "forbidden" | "not_found" | "case_archived" | "conflict";

type MutationResult =
  | { status: "updated" | "unchanged"; update: CaseUpdateRecord }
  | { status: MutationFailure };

export type CaseUpdateStore = {
  hasMembership(userId: string, organizationId: string): Promise<boolean>;
  list(
    organizationId: string,
    caseId: string,
    input: {
      status: CaseUpdateStatus;
      kind?: CaseUpdateKind;
      page: number;
      pageSize: number;
    },
  ): Promise<{ updates: CaseUpdateRecord[]; total: number } | null>;
  create(
    actor: CaseUpdateActor,
    caseId: string,
    updateId: string,
    values: CaseUpdateValues,
  ): Promise<
    | { status: "created"; update: CaseUpdateRecord }
    | { status: MutationFailure }
  >;
  update(
    actor: CaseUpdateActor,
    caseId: string,
    updateId: string,
    values: Partial<CaseUpdateValues>,
    expectedUpdatedAt: string,
  ): Promise<MutationResult>;
  archive(
    actor: CaseUpdateActor,
    caseId: string,
    updateId: string,
    expectedUpdatedAt: string,
  ): Promise<MutationResult>;
  restore(
    actor: CaseUpdateActor,
    caseId: string,
    updateId: string,
    expectedUpdatedAt: string,
  ): Promise<MutationResult>;
  previewMoveAllToBackground(
    organizationId: string,
  ): Promise<{ movedCount: number; caseCount: number }>;
  moveAllToBackground(actor: CaseUpdateActor): Promise<
    | {
        status: "updated" | "unchanged";
        movedCount: number;
        caseCount: number;
      }
    | { status: MutationFailure }
  >;
};

export type CaseUpdateServiceErrorCode =
  "FORBIDDEN" | "NOT_FOUND" | "VALIDATION_ERROR" | "CASE_ARCHIVED" | "CONFLICT";

export class CaseUpdateServiceError extends Error {
  constructor(
    readonly code: CaseUpdateServiceErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "CaseUpdateServiceError";
  }
}

function normalizeDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) {
    throw new CaseUpdateServiceError(
      "VALIDATION_ERROR",
      "Selecciona una fecha válida.",
    );
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() + 1 !== month ||
    parsed.getUTCDate() !== day
  ) {
    throw new CaseUpdateServiceError(
      "VALIDATION_ERROR",
      "Selecciona una fecha válida.",
    );
  }
  return value;
}

function normalizeDescription(value: string) {
  const description = value.trim();
  if (!description || description.length > 5_000) {
    throw new CaseUpdateServiceError(
      "VALIDATION_ERROR",
      "La descripción debe tener entre 1 y 5000 caracteres.",
    );
  }
  return description;
}

function normalizeVersion(value: string) {
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) {
    throw new CaseUpdateServiceError(
      "VALIDATION_ERROR",
      "La versión de la novedad no es válida.",
    );
  }
  return parsed.toISOString();
}

function throwFailure(status: MutationFailure): never {
  if (status === "forbidden") {
    throw new CaseUpdateServiceError(
      "FORBIDDEN",
      "No tienes acceso a este estudio.",
    );
  }
  if (status === "case_archived") {
    throw new CaseUpdateServiceError(
      "CASE_ARCHIVED",
      "El caso está archivado. Restáuralo para realizar cambios.",
    );
  }
  if (status === "conflict") {
    throw new CaseUpdateServiceError(
      "CONFLICT",
      "La novedad cambió mientras la editabas. Actualiza e inténtalo nuevamente.",
    );
  }
  throw new CaseUpdateServiceError("NOT_FOUND", "Novedad no encontrada.");
}

export function createCaseUpdateService(
  store: CaseUpdateStore,
  createId: () => string = () => crypto.randomUUID(),
) {
  async function assertMembership(actor: CaseUpdateActor) {
    if (!(await store.hasMembership(actor.userId, actor.organizationId))) {
      throwFailure("forbidden");
    }
  }

  return {
    async list(
      actor: CaseUpdateActor,
      caseId: string,
      input: {
        status?: CaseUpdateStatus;
        kind?: CaseUpdateKind;
        page?: number;
        pageSize?: number;
      },
    ) {
      await assertMembership(actor);
      const page = input.page ?? 1;
      const pageSize = input.pageSize ?? 10;
      const result = await store.list(actor.organizationId, caseId, {
        status: input.status ?? "active",
        ...(input.kind ? { kind: input.kind } : {}),
        page,
        pageSize,
      });
      if (!result) throwFailure("not_found");
      return {
        updates: result.updates,
        pagination: {
          page,
          pageSize,
          total: result.total,
          totalPages: result.total ? Math.ceil(result.total / pageSize) : 0,
        },
      };
    },

    async create(
      actor: CaseUpdateActor,
      caseId: string,
      input: CreateCaseUpdateInput,
    ) {
      await assertMembership(actor);
      const result = await store.create(actor, caseId, createId(), {
        date: normalizeDate(input.date),
        description: normalizeDescription(input.description),
        kind: "update",
      });
      if (result.status !== "created") throwFailure(result.status);
      return result.update;
    },

    async update(
      actor: CaseUpdateActor,
      caseId: string,
      updateId: string,
      input: UpdateCaseUpdateInput,
    ) {
      await assertMembership(actor);
      const values: Partial<CaseUpdateValues> = {};
      if (input.date !== undefined) values.date = normalizeDate(input.date);
      if (input.description !== undefined) {
        values.description = normalizeDescription(input.description);
      }
      if (input.kind !== undefined) values.kind = input.kind;
      const result = await store.update(
        actor,
        caseId,
        updateId,
        values,
        normalizeVersion(input.expectedUpdatedAt),
      );
      if (result.status !== "updated" && result.status !== "unchanged") {
        throwFailure(result.status);
      }
      return result.update;
    },

    async archive(
      actor: CaseUpdateActor,
      caseId: string,
      updateId: string,
      expectedUpdatedAt: string,
    ) {
      await assertMembership(actor);
      const result = await store.archive(
        actor,
        caseId,
        updateId,
        normalizeVersion(expectedUpdatedAt),
      );
      if (result.status !== "updated" && result.status !== "unchanged") {
        throwFailure(result.status);
      }
      return result.update;
    },

    async restore(
      actor: CaseUpdateActor,
      caseId: string,
      updateId: string,
      expectedUpdatedAt: string,
    ) {
      await assertMembership(actor);
      const result = await store.restore(
        actor,
        caseId,
        updateId,
        normalizeVersion(expectedUpdatedAt),
      );
      if (result.status !== "updated" && result.status !== "unchanged") {
        throwFailure(result.status);
      }
      return result.update;
    },

    async previewMoveAllToBackground(actor: CaseUpdateActor) {
      await assertMembership(actor);
      return store.previewMoveAllToBackground(actor.organizationId);
    },

    async moveAllToBackground(actor: CaseUpdateActor) {
      await assertMembership(actor);
      const result = await store.moveAllToBackground(actor);
      if (result.status !== "updated" && result.status !== "unchanged") {
        throwFailure(result.status);
      }
      return {
        movedCount: result.movedCount,
        caseCount: result.caseCount,
      };
    },
  };
}

export type CaseUpdateService = ReturnType<typeof createCaseUpdateService>;
