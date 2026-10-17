import type {
  ClientActor,
  ClientFilters,
  ClientListFilters,
  ClientPatchValues,
  ClientRecord,
  ClientValues,
  CreateClientInput,
  UpdateClientInput,
} from "./client-types";

export type ClientServiceErrorCode = "FORBIDDEN" | "NOT_FOUND";

export class ClientServiceError extends Error {
  readonly code: ClientServiceErrorCode;

  constructor(code: ClientServiceErrorCode, message: string) {
    super(message);
    this.name = "ClientServiceError";
    this.code = code;
  }
}

export type ClientStore = {
  hasMembership(userId: string, organizationId: string): Promise<boolean>;
  list(
    organizationId: string,
    filters: ClientListFilters,
  ): Promise<{ clients: ClientRecord[]; total: number }>;
  get(organizationId: string, clientId: string): Promise<ClientRecord | null>;
  create(
    organizationId: string,
    clientId: string,
    values: ClientValues,
  ): Promise<ClientRecord>;
  update(
    organizationId: string,
    clientId: string,
    values: ClientPatchValues,
  ): Promise<ClientRecord | null>;
};

function normalizeOptional(value: string | null | undefined) {
  if (value === undefined || value === null) return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function normalizeCreateInput(input: CreateClientInput): ClientValues {
  return {
    type: input.type,
    name: input.name.trim(),
    documentType: normalizeOptional(input.documentType),
    documentNumber: normalizeOptional(input.documentNumber),
    email: normalizeOptional(input.email),
    phone: normalizeOptional(input.phone),
    address: normalizeOptional(input.address),
    notes: normalizeOptional(input.notes),
  };
}

function normalizeUpdateInput(input: UpdateClientInput): ClientPatchValues {
  const values: ClientPatchValues = {};

  if (input.type !== undefined) values.type = input.type;
  if (input.name !== undefined) values.name = input.name.trim();
  if (input.documentType !== undefined) {
    values.documentType = normalizeOptional(input.documentType);
  }
  if (input.documentNumber !== undefined) {
    values.documentNumber = normalizeOptional(input.documentNumber);
  }
  if (input.email !== undefined) values.email = normalizeOptional(input.email);
  if (input.phone !== undefined) values.phone = normalizeOptional(input.phone);
  if (input.address !== undefined) {
    values.address = normalizeOptional(input.address);
  }
  if (input.notes !== undefined) values.notes = normalizeOptional(input.notes);

  return values;
}

export function createClientService(
  store: ClientStore,
  createId: () => string = () => crypto.randomUUID(),
) {
  async function assertMembership(actor: ClientActor) {
    if (!(await store.hasMembership(actor.userId, actor.organizationId))) {
      throw new ClientServiceError(
        "FORBIDDEN",
        "No tienes acceso a este estudio.",
      );
    }
  }

  return {
    async list(actor: ClientActor, filters: ClientFilters) {
      await assertMembership(actor);
      const page = filters.page ?? 1;
      const pageSize = filters.pageSize ?? 25;
      const result = await store.list(actor.organizationId, {
        search: filters.search?.trim() || undefined,
        type: filters.type,
        page,
        pageSize,
      });

      return {
        clients: result.clients,
        pagination: {
          page,
          pageSize,
          total: result.total,
          totalPages:
            result.total === 0 ? 0 : Math.ceil(result.total / pageSize),
        },
      };
    },

    async get(actor: ClientActor, clientId: string) {
      await assertMembership(actor);
      const result = await store.get(actor.organizationId, clientId);

      if (!result) {
        throw new ClientServiceError("NOT_FOUND", "Cliente no encontrado.");
      }

      return result;
    },

    async create(actor: ClientActor, input: CreateClientInput) {
      await assertMembership(actor);
      return store.create(
        actor.organizationId,
        createId(),
        normalizeCreateInput(input),
      );
    },

    async update(
      actor: ClientActor,
      clientId: string,
      input: UpdateClientInput,
    ) {
      await assertMembership(actor);
      const result = await store.update(
        actor.organizationId,
        clientId,
        normalizeUpdateInput(input),
      );

      if (!result) {
        throw new ClientServiceError("NOT_FOUND", "Cliente no encontrado.");
      }

      return result;
    },
  };
}

export type ClientService = ReturnType<typeof createClientService>;
