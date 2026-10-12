import type {
  CaseEventActor,
  CaseEventCalendarFilters,
  CaseEventCalendarItem,
  CaseEventRecord,
  CaseEventValues,
  CreateCaseEventInput,
  UpdateCaseEventInput,
} from "./case-event-types";

type MutationFailure = "forbidden" | "not_found" | "case_archived" | "conflict";

export type CaseEventStore = {
  hasMembership(userId: string, organizationId: string): Promise<boolean>;
  list(
    organizationId: string,
    caseId: string,
    pagination: { page: number; pageSize: number },
  ): Promise<{ events: CaseEventRecord[]; total: number } | null>;
  calendar(
    organizationId: string,
    filters: CaseEventCalendarFilters & { limit: number },
  ): Promise<CaseEventCalendarItem[]>;
  create(
    actor: CaseEventActor,
    caseId: string,
    eventId: string,
    values: CaseEventValues,
  ): Promise<
    { status: "created"; event: CaseEventRecord } | { status: MutationFailure }
  >;
  update(
    actor: CaseEventActor,
    caseId: string,
    eventId: string,
    values: Partial<CaseEventValues>,
    expectedUpdatedAt: string,
  ): Promise<
    | { status: "updated" | "unchanged"; event: CaseEventRecord }
    | { status: MutationFailure }
  >;
  remove(
    actor: CaseEventActor,
    caseId: string,
    eventId: string,
    expectedUpdatedAt: string,
  ): Promise<{ status: "removed" } | { status: MutationFailure }>;
};

export type CaseEventServiceErrorCode =
  "FORBIDDEN" | "NOT_FOUND" | "VALIDATION_ERROR" | "CASE_ARCHIVED" | "CONFLICT";

export class CaseEventServiceError extends Error {
  constructor(
    readonly code: CaseEventServiceErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "CaseEventServiceError";
  }
}

function normalizeOptional(value: string | null | undefined) {
  if (value === undefined || value === null) return null;
  return value.trim() || null;
}

function normalizeDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) {
    throw new CaseEventServiceError(
      "VALIDATION_ERROR",
      "Selecciona una fecha válida para el evento.",
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
    throw new CaseEventServiceError(
      "VALIDATION_ERROR",
      "Selecciona una fecha válida para el evento.",
    );
  }
  return value;
}

function unique(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function calendarDayNumber(value: string) {
  const normalized = normalizeDate(value);
  const [year, month, day] = normalized.split("-").map(Number);
  return Math.floor(Date.UTC(year!, month! - 1, day!) / 86_400_000);
}

function normalizeVersion(value: string) {
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) {
    throw new CaseEventServiceError(
      "VALIDATION_ERROR",
      "La versión del evento no es válida.",
    );
  }
  return parsed.toISOString();
}

function throwFailure(status: MutationFailure): never {
  if (status === "forbidden") {
    throw new CaseEventServiceError(
      "FORBIDDEN",
      "No tienes acceso a este estudio.",
    );
  }
  if (status === "case_archived") {
    throw new CaseEventServiceError(
      "CASE_ARCHIVED",
      "El caso está archivado. Restáuralo para realizar cambios.",
    );
  }
  if (status === "conflict") {
    throw new CaseEventServiceError(
      "CONFLICT",
      "El evento cambió mientras lo editabas. Actualiza e inténtalo nuevamente.",
    );
  }
  throw new CaseEventServiceError("NOT_FOUND", "Evento no encontrado.");
}

export function createCaseEventService(
  store: CaseEventStore,
  createId: () => string = () => crypto.randomUUID(),
) {
  async function assertMembership(actor: CaseEventActor) {
    if (!(await store.hasMembership(actor.userId, actor.organizationId))) {
      throwFailure("forbidden");
    }
  }

  return {
    async calendar(actor: CaseEventActor, input: CaseEventCalendarFilters) {
      await assertMembership(actor);
      const fromDay = calendarDayNumber(input.from);
      const toDay = calendarDayNumber(input.to);
      if (fromDay > toDay || toDay - fromDay > 41) {
        throw new CaseEventServiceError(
          "VALIDATION_ERROR",
          "El rango del calendario debe contener como máximo 42 días.",
        );
      }
      const rows = await store.calendar(actor.organizationId, {
        from: input.from,
        to: input.to,
        caseStatus: input.caseStatus,
        ...(input.search?.trim() ? { search: input.search.trim() } : {}),
        types: unique(input.types) as CaseEventCalendarFilters["types"],
        clientIds: unique(input.clientIds),
        memberUserIds: unique(input.memberUserIds),
        limit: 501,
      });
      return { events: rows.slice(0, 500), truncated: rows.length > 500 };
    },

    async list(
      actor: CaseEventActor,
      caseId: string,
      query: { page?: number; pageSize?: number },
    ) {
      await assertMembership(actor);
      const page = query.page ?? 1;
      const pageSize = query.pageSize ?? 25;
      const result = await store.list(actor.organizationId, caseId, {
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
          totalPages: result.total ? Math.ceil(result.total / pageSize) : 0,
        },
      };
    },

    async create(
      actor: CaseEventActor,
      caseId: string,
      input: CreateCaseEventInput,
    ) {
      await assertMembership(actor);
      const result = await store.create(actor, caseId, createId(), {
        title: input.title.trim(),
        type: input.type,
        date: normalizeDate(input.date),
        description: normalizeOptional(input.description),
      });
      if (result.status !== "created") throwFailure(result.status);
      return result.event;
    },

    async update(
      actor: CaseEventActor,
      caseId: string,
      eventId: string,
      input: UpdateCaseEventInput,
    ) {
      await assertMembership(actor);
      const values: Partial<CaseEventValues> = {};
      if (input.title !== undefined) values.title = input.title.trim();
      if (input.type !== undefined) values.type = input.type;
      if (input.date !== undefined) values.date = normalizeDate(input.date);
      if (input.description !== undefined) {
        values.description = normalizeOptional(input.description);
      }
      const result = await store.update(
        actor,
        caseId,
        eventId,
        values,
        normalizeVersion(input.expectedUpdatedAt),
      );
      if (result.status !== "updated" && result.status !== "unchanged") {
        throwFailure(result.status);
      }
      return result.event;
    },

    async remove(
      actor: CaseEventActor,
      caseId: string,
      eventId: string,
      expectedUpdatedAt: string,
    ) {
      await assertMembership(actor);
      const result = await store.remove(
        actor,
        caseId,
        eventId,
        normalizeVersion(expectedUpdatedAt),
      );
      if (result.status !== "removed") throwFailure(result.status);
    },
  };
}

export type CaseEventService = ReturnType<typeof createCaseEventService>;
