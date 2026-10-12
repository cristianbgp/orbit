import {
  CaseDomainError,
  normalizeCasePeriod,
  validateCaseClassification,
  validateCaseMoney,
  validateCaseStatusResult,
  type CasePeriodInput,
} from "./case-domain";
import type {
  CaseClaimantType,
  CaseCurrency,
  CaseEntity,
  CasePeriodKind,
  CaseResult,
  CaseStage,
  CaseStatus,
  CaseSubtype,
  CaseTax,
  CaseType,
} from "./case-types";

export type CaseActor = { userId: string; organizationId: string };
export type CaseClient = { id: string; name: string };

export type CaseMember = {
  userId: string;
  fullName: string;
  alias: string;
  avatarColor: string | null;
  position: "partner" | "senior" | "junior" | "assistant" | "intern" | null;
};

export type CaseResponsibility = "member" | "follower";
export type CasePeople = { members: CaseMember[]; total: number };

export type CaseValues = {
  clientId: string;
  identification: string;
  type: CaseType | null;
  subtype: CaseSubtype | null;
  stage: CaseStage | null;
  entity: CaseEntity | null;
  docketNumber: string | null;
  tax: CaseTax | null;
  periodKind: CasePeriodKind | null;
  periodStart: string | null;
  periodEnd: string | null;
  amount: string | null;
  currency: CaseCurrency | null;
  claimantType: CaseClaimantType | null;
  disputedMatter: string | null;
  challengedResolution: string | null;
  status: CaseStatus;
  result: CaseResult | null;
};

export type CaseRecord = CaseValues & {
  id: string;
  organizationId: string;
  client: CaseClient;
  team: CasePeople;
  followers: CasePeople;
  activeActionCount: number;
  activeUpdateCount: number;
  archivedAt: Date | null;
  createdByUserId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type CaseInput = {
  clientId: string;
  identification: string;
  type?: CaseType | null;
  subtype?: CaseSubtype | null;
  stage?: CaseStage | null;
  entity?: CaseEntity | null;
  docketNumber?: string | null;
  tax?: CaseTax | null;
  period?: CasePeriodInput;
  amount?: string | null;
  currency?: CaseCurrency | null;
  claimantType?: CaseClaimantType | null;
  disputedMatter?: string | null;
  challengedResolution?: string | null;
  status?: CaseStatus;
  result?: CaseResult | null;
  initialMemberUserIds?: string[];
  initialFollowerUserIds?: string[];
};

export type CaseUpdateInput = Partial<
  Omit<CaseInput, "initialMemberUserIds" | "initialFollowerUserIds">
>;

export type CaseFilters = {
  search?: string;
  type?: CaseType[];
  status?: CaseStatus[];
  client?: string[];
  member?: string[];
  archived?: boolean;
  page?: number;
  pageSize?: number;
  orderBy?: "identification" | "createdAt" | "updatedAt";
  order?: "asc" | "desc";
};

export type CaseListFilters = Omit<
  CaseFilters,
  "type" | "status" | "client" | "member"
> & {
  types?: CaseType[];
  statuses?: CaseStatus[];
  clientIds?: string[];
  memberUserIds?: string[];
  page: number;
  pageSize: number;
};

export type CaseAssignmentRecord = {
  id: string;
  userId: string | null;
  userName: string;
  userEmail: string;
  userAlias: string;
  userAvatarColor: string | null;
  position: CaseMember["position"];
  activeStudioMember: boolean;
  assignedAt: Date;
  endedAt: Date | null;
  responsibility: CaseResponsibility;
};

export type CaseActivityRecord = {
  id: string;
  type: string;
  actor: CaseActivityIdentity;
  subject: CaseActivityIdentity | null;
  details: Record<string, string | null>;
  createdAt: Date;
};

export type CaseActivityIdentity = {
  userId: string | null;
  nameSnapshot: string;
  alias: string | null;
  avatarColor: string | null;
  activeStudioMember: boolean;
  linkable: boolean;
};

export type CaseStore = {
  hasMembership(userId: string, organizationId: string): Promise<boolean>;
  findClient(
    organizationId: string,
    clientId: string,
  ): Promise<CaseClient | null>;
  list(
    organizationId: string,
    filters: CaseListFilters,
  ): Promise<{ cases: CaseRecord[]; total: number }>;
  listGroupedByClient(
    organizationId: string,
    filters: CaseListFilters,
  ): Promise<{
    groups: Array<{ client: CaseClient; cases: CaseRecord[] }>;
    clientTotal: number;
    caseTotal: number;
  }>;
  get(organizationId: string, caseId: string): Promise<CaseRecord | null>;
  create(
    actor: CaseActor,
    caseId: string,
    values: CaseValues,
    assignments: { members: string[]; followers: string[] },
  ): Promise<
    | { status: "created"; case: CaseRecord }
    | { status: "client_not_found" | "member_not_found" }
  >;
  update(
    actor: CaseActor,
    caseId: string,
    values: Partial<CaseValues>,
  ): Promise<
    | { status: "updated" | "unchanged"; case: CaseRecord }
    | { status: "not_found" | "client_not_found" | "case_archived" }
  >;
  archive(
    actor: CaseActor,
    caseId: string,
  ): Promise<
    | { status: "updated"; case: CaseRecord }
    | { status: "not_found" | "conflict" }
  >;
  restore(
    actor: CaseActor,
    caseId: string,
  ): Promise<
    | { status: "updated"; case: CaseRecord }
    | { status: "not_found" | "conflict" }
  >;
  listAssignments(
    organizationId: string,
    caseId: string,
    input: {
      responsibility: CaseResponsibility;
      historyPage: number;
      historyPageSize: number;
    },
  ): Promise<{
    active: CaseAssignmentRecord[];
    history: CaseAssignmentRecord[];
    historyTotal: number;
  } | null>;
  listCandidates(
    organizationId: string,
    caseId: string,
    responsibility: CaseResponsibility,
  ): Promise<CaseMember[] | null>;
  addAssignments(
    actor: CaseActor,
    caseId: string,
    userIds: string[],
    responsibility: CaseResponsibility,
  ): Promise<
    | { status: "updated" }
    | {
        status: "not_found" | "case_archived" | "member_not_found" | "conflict";
      }
  >;
  endAssignment(
    actor: CaseActor,
    caseId: string,
    assignmentId: string,
  ): Promise<
    | { status: "updated" }
    | { status: "not_found" | "case_archived" | "conflict" }
  >;
  listActivities(
    organizationId: string,
    caseId: string,
    input: { page: number; pageSize: number },
  ): Promise<{ activities: CaseActivityRecord[]; total: number } | null>;
};

export type CaseServiceErrorCode =
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CLIENT_NOT_FOUND"
  | "MEMBER_NOT_FOUND"
  | "VALIDATION_ERROR"
  | "CASE_ARCHIVED"
  | "CONFLICT";

export class CaseServiceError extends Error {
  constructor(
    readonly code: CaseServiceErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "CaseServiceError";
  }
}

const optionalText = (value: string | null | undefined) =>
  value?.trim() || null;
const unique = (values?: string[]) =>
  values
    ? [...new Set(values.map((value) => value.trim()).filter(Boolean))]
    : [];

function mapDomainError(error: unknown): never {
  if (error instanceof CaseDomainError) {
    throw new CaseServiceError("VALIDATION_ERROR", error.message);
  }
  throw error;
}

export function createCaseService(
  store: CaseStore,
  createId: () => string = () => crypto.randomUUID(),
) {
  async function assertMembership(actor: CaseActor) {
    if (!(await store.hasMembership(actor.userId, actor.organizationId))) {
      throw new CaseServiceError(
        "FORBIDDEN",
        "No tienes acceso a este estudio.",
      );
    }
  }

  async function createValues(input: CaseInput): Promise<CaseValues> {
    try {
      const classification = validateCaseClassification({
        type: input.type ?? null,
        subtype: input.subtype ?? null,
        stage: input.stage ?? null,
      });
      const period = normalizeCasePeriod(input.period ?? null);
      const money = validateCaseMoney({
        amount: input.amount ?? null,
        currency: input.currency ?? null,
      });
      const outcome = validateCaseStatusResult({
        status: input.status ?? "in_progress",
        result: input.result ?? null,
      });
      return {
        clientId: input.clientId.trim(),
        identification: input.identification.trim(),
        ...classification,
        entity: input.entity ?? null,
        docketNumber: classification.stage
          ? optionalText(input.docketNumber)
          : null,
        tax: input.tax ?? null,
        ...period,
        ...money,
        claimantType:
          classification.type === "judicial"
            ? (input.claimantType ?? "client")
            : null,
        disputedMatter: optionalText(input.disputedMatter),
        challengedResolution: optionalText(input.challengedResolution),
        ...outcome,
      };
    } catch (error) {
      mapDomainError(error);
    }
  }

  function currentPeriod(record: CaseRecord): CasePeriodInput {
    if (!record.periodKind || !record.periodStart || !record.periodEnd)
      return null;
    if (record.periodKind === "year")
      return { kind: "year", year: Number(record.periodStart.slice(0, 4)) };
    if (record.periodKind === "month")
      return { kind: "month", month: record.periodStart.slice(0, 7) };
    return {
      kind: "month_range",
      startMonth: record.periodStart.slice(0, 7),
      endMonth: record.periodEnd.slice(0, 7),
    };
  }

  return {
    async list(actor: CaseActor, filters: CaseFilters) {
      await assertMembership(actor);
      const page = filters.page ?? 1;
      const pageSize = filters.pageSize ?? 25;
      const result = await store.list(actor.organizationId, {
        search: filters.search?.trim() || undefined,
        types: unique(filters.type) as CaseType[],
        statuses: unique(filters.status) as CaseStatus[],
        clientIds: unique(filters.client),
        memberUserIds: unique(filters.member),
        archived: filters.archived ?? false,
        page,
        pageSize,
        orderBy: filters.orderBy ?? "updatedAt",
        order: filters.order ?? "desc",
      });
      return {
        cases: result.cases,
        pagination: {
          page,
          pageSize,
          total: result.total,
          totalPages: result.total ? Math.ceil(result.total / pageSize) : 0,
        },
      };
    },
    async listGroupedByClient(actor: CaseActor, filters: CaseFilters) {
      await assertMembership(actor);
      const page = filters.page ?? 1;
      const pageSize = filters.pageSize ?? 10;
      const result = await store.listGroupedByClient(actor.organizationId, {
        search: filters.search?.trim() || undefined,
        types: unique(filters.type) as CaseType[],
        statuses: unique(filters.status) as CaseStatus[],
        clientIds: unique(filters.client),
        memberUserIds: unique(filters.member),
        archived: filters.archived ?? false,
        page,
        pageSize,
        orderBy: filters.orderBy ?? "updatedAt",
        order: filters.order ?? "desc",
      });
      return {
        groups: result.groups,
        caseTotal: result.caseTotal,
        pagination: {
          page,
          pageSize,
          total: result.clientTotal,
          totalPages: result.clientTotal
            ? Math.ceil(result.clientTotal / pageSize)
            : 0,
        },
      };
    },
    async get(actor: CaseActor, caseId: string) {
      await assertMembership(actor);
      const record = await store.get(actor.organizationId, caseId);
      if (!record)
        throw new CaseServiceError("NOT_FOUND", "Caso no encontrado.");
      return record;
    },
    async create(actor: CaseActor, input: CaseInput) {
      await assertMembership(actor);
      if (!input.identification.trim())
        throw new CaseServiceError(
          "VALIDATION_ERROR",
          "Ingresa la identificación del caso.",
        );
      const clientId = input.clientId.trim();
      const client = await store.findClient(actor.organizationId, clientId);
      if (!client)
        throw new CaseServiceError(
          "CLIENT_NOT_FOUND",
          "Cliente no disponible.",
        );
      const values = await createValues({ ...input, clientId });
      const result = await store.create(actor, createId(), values, {
        members: unique(input.initialMemberUserIds),
        followers: unique(input.initialFollowerUserIds),
      });
      if (result.status !== "created")
        throw new CaseServiceError(
          result.status === "client_not_found"
            ? "CLIENT_NOT_FOUND"
            : "MEMBER_NOT_FOUND",
          result.status === "client_not_found"
            ? "Cliente no disponible."
            : "Uno de los miembros no está disponible.",
        );
      return result.case;
    },
    async update(actor: CaseActor, caseId: string, input: CaseUpdateInput) {
      await assertMembership(actor);
      const current = await store.get(actor.organizationId, caseId);
      if (!current)
        throw new CaseServiceError("NOT_FOUND", "Caso no encontrado.");
      const mergedInput: CaseInput = {
        clientId: input.clientId ?? current.clientId,
        identification: input.identification ?? current.identification,
        type: input.type === undefined ? current.type : input.type,
        subtype: input.subtype === undefined ? current.subtype : input.subtype,
        stage: input.stage === undefined ? current.stage : input.stage,
        entity: input.entity === undefined ? current.entity : input.entity,
        docketNumber:
          input.docketNumber === undefined
            ? current.docketNumber
            : input.docketNumber,
        tax: input.tax === undefined ? current.tax : input.tax,
        period:
          input.period === undefined ? currentPeriod(current) : input.period,
        amount: input.amount === undefined ? current.amount : input.amount,
        currency:
          input.currency === undefined ? current.currency : input.currency,
        claimantType:
          input.claimantType === undefined
            ? current.claimantType
            : input.claimantType,
        disputedMatter:
          input.disputedMatter === undefined
            ? current.disputedMatter
            : input.disputedMatter,
        challengedResolution:
          input.challengedResolution === undefined
            ? current.challengedResolution
            : input.challengedResolution,
        status: input.status ?? current.status,
        result: input.result === undefined ? current.result : input.result,
      };
      const client =
        mergedInput.clientId === current.clientId
          ? current.client
          : await store.findClient(actor.organizationId, mergedInput.clientId);
      if (!client)
        throw new CaseServiceError(
          "CLIENT_NOT_FOUND",
          "Cliente no disponible.",
        );
      const values = await createValues(mergedInput);
      const result = await store.update(actor, caseId, values);
      switch (result.status) {
        case "not_found":
          throw new CaseServiceError("NOT_FOUND", "Caso no encontrado.");
        case "client_not_found":
          throw new CaseServiceError(
            "CLIENT_NOT_FOUND",
            "Cliente no disponible.",
          );
        case "case_archived":
          throw new CaseServiceError(
            "CASE_ARCHIVED",
            "Restaura el caso antes de modificarlo.",
          );
        default:
          return result.case;
      }
    },
    async archive(actor: CaseActor, caseId: string) {
      await assertMembership(actor);
      const result = await store.archive(actor, caseId);
      switch (result.status) {
        case "not_found":
          throw new CaseServiceError("NOT_FOUND", "Caso no encontrado.");
        case "conflict":
          throw new CaseServiceError("CONFLICT", "El caso ya está archivado.");
        default:
          return result.case;
      }
    },
    async restore(actor: CaseActor, caseId: string) {
      await assertMembership(actor);
      const result = await store.restore(actor, caseId);
      switch (result.status) {
        case "not_found":
          throw new CaseServiceError("NOT_FOUND", "Caso no encontrado.");
        case "conflict":
          throw new CaseServiceError("CONFLICT", "El caso no está archivado.");
        default:
          return result.case;
      }
    },
    async listAssignments(
      actor: CaseActor,
      caseId: string,
      input: {
        responsibility?: CaseResponsibility;
        historyPage?: number;
        historyPageSize?: number;
      },
    ) {
      await assertMembership(actor);
      const result = await store.listAssignments(actor.organizationId, caseId, {
        responsibility: input.responsibility ?? "member",
        historyPage: input.historyPage ?? 1,
        historyPageSize: input.historyPageSize ?? 20,
      });
      if (!result)
        throw new CaseServiceError("NOT_FOUND", "Caso no encontrado.");
      return result;
    },
    async listCandidates(
      actor: CaseActor,
      caseId: string,
      responsibility: CaseResponsibility = "member",
    ) {
      await assertMembership(actor);
      const result = await store.listCandidates(
        actor.organizationId,
        caseId,
        responsibility,
      );
      if (!result)
        throw new CaseServiceError("NOT_FOUND", "Caso no encontrado.");
      return result;
    },
    async addAssignments(
      actor: CaseActor,
      caseId: string,
      userIds: string[],
      responsibility: CaseResponsibility = "member",
    ) {
      await assertMembership(actor);
      const result = await store.addAssignments(
        actor,
        caseId,
        unique(userIds),
        responsibility,
      );
      if (result.status !== "updated")
        throw new CaseServiceError(
          result.status === "not_found"
            ? "NOT_FOUND"
            : result.status === "case_archived"
              ? "CASE_ARCHIVED"
              : result.status === "member_not_found"
                ? "MEMBER_NOT_FOUND"
                : "CONFLICT",
          result.status === "case_archived"
            ? "Restaura el caso antes de modificarlo."
            : "No pudimos asignar a los miembros.",
        );
    },
    async endAssignment(
      actor: CaseActor,
      caseId: string,
      assignmentId: string,
    ) {
      await assertMembership(actor);
      const result = await store.endAssignment(actor, caseId, assignmentId);
      if (result.status !== "updated")
        throw new CaseServiceError(
          result.status === "not_found"
            ? "NOT_FOUND"
            : result.status === "case_archived"
              ? "CASE_ARCHIVED"
              : "CONFLICT",
          result.status === "case_archived"
            ? "Restaura el caso antes de modificarlo."
            : "No pudimos retirar al miembro.",
        );
    },
    async listActivities(
      actor: CaseActor,
      caseId: string,
      input: { page?: number; pageSize?: number },
    ) {
      await assertMembership(actor);
      const page = input.page ?? 1;
      const pageSize = input.pageSize ?? 20;
      const result = await store.listActivities(actor.organizationId, caseId, {
        page,
        pageSize,
      });
      if (!result)
        throw new CaseServiceError("NOT_FOUND", "Caso no encontrado.");
      return {
        activities: result.activities,
        pagination: {
          page,
          pageSize,
          total: result.total,
          totalPages: result.total ? Math.ceil(result.total / pageSize) : 0,
        },
      };
    },
  };
}

export type CaseService = ReturnType<typeof createCaseService>;
