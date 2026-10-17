import { describe, expect, test, vi } from "vitest";

import {
  ClientServiceError,
  createClientService,
  type ClientStore,
} from "../src/clients/client-service";
import type { ClientRecord } from "../src/clients/client-types";

const actor = { userId: "user-1", organizationId: "org-1" };

function createStore(overrides: Partial<ClientStore> = {}): ClientStore {
  return {
    hasMembership: vi.fn().mockResolvedValue(true),
    list: vi.fn().mockResolvedValue({ clients: [], total: 0 }),
    get: vi.fn().mockResolvedValue(null),
    create: vi.fn(),
    update: vi.fn().mockResolvedValue(null),
    ...overrides,
  };
}

describe("client service", () => {
  test("rejects access when the user is not a member of the active organization", async () => {
    const store = createStore({
      hasMembership: vi.fn().mockResolvedValue(false),
    });
    const service = createClientService(store);

    await expect(service.list(actor, {})).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    expect(store.list).not.toHaveBeenCalled();
  });

  test("defaults and normalizes client pagination", async () => {
    const store = createStore({
      list: vi.fn().mockResolvedValue({ clients: [], total: 52 }),
    });
    const service = createClientService(store);

    await expect(
      service.list(actor, { search: "  Acme  ", type: "company" }),
    ).resolves.toEqual({
      clients: [],
      pagination: { page: 1, pageSize: 25, total: 52, totalPages: 3 },
    });

    expect(store.list).toHaveBeenCalledWith("org-1", {
      search: "Acme",
      type: "company",
      page: 1,
      pageSize: 25,
    });
  });

  test("preserves an explicit page and page size", async () => {
    const store = createStore({
      list: vi.fn().mockResolvedValue({ clients: [], total: 52 }),
    });
    const service = createClientService(store);

    await expect(
      service.list(actor, { page: 3, pageSize: 10 }),
    ).resolves.toEqual({
      clients: [],
      pagination: { page: 3, pageSize: 10, total: 52, totalPages: 6 },
    });
  });

  test("normalizes empty optional fields before creating a client", async () => {
    const created: ClientRecord = {
      id: "client-1",
      organizationId: "org-1",
      type: "person",
      name: "Ana Torres",
      documentType: null,
      documentNumber: "44556677",
      email: null,
      phone: null,
      address: null,
      notes: null,
      createdAt: new Date("2026-08-05T10:00:00.000Z"),
      updatedAt: new Date("2026-08-05T10:00:00.000Z"),
    };
    const store = createStore({
      create: vi.fn().mockResolvedValue(created),
    });
    const service = createClientService(store, () => "client-1");

    await expect(
      service.create(actor, {
        type: "person",
        name: "  Ana Torres  ",
        documentType: " ",
        documentNumber: " 44556677 ",
        email: "",
        phone: null,
        address: "  ",
        notes: undefined,
      }),
    ).resolves.toEqual(created);

    expect(store.create).toHaveBeenCalledWith("org-1", "client-1", {
      type: "person",
      name: "Ana Torres",
      documentType: null,
      documentNumber: "44556677",
      email: null,
      phone: null,
      address: null,
      notes: null,
    });
  });

  test("returns not found when updating outside the organization scope", async () => {
    const store = createStore({ update: vi.fn().mockResolvedValue(null) });
    const service = createClientService(store);

    await expect(
      service.update(actor, "client-from-another-org", { name: "Nuevo" }),
    ).rejects.toEqual(
      new ClientServiceError("NOT_FOUND", "Cliente no encontrado."),
    );
    expect(store.update).toHaveBeenCalledWith(
      "org-1",
      "client-from-another-org",
      { name: "Nuevo" },
    );
  });
});
