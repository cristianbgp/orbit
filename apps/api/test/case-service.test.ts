import { describe, expect, test, vi } from "vitest";

import {
  CaseServiceError,
  createCaseService,
  type CaseStore,
} from "../src/cases/case-service";

const actor = { userId: "user-1", organizationId: "org-1" };

function createStore(overrides: Partial<CaseStore> = {}): CaseStore {
  return {
    hasMembership: vi.fn().mockResolvedValue(true),
    findClient: vi.fn().mockResolvedValue({ id: "client-1", name: "BBVA" }),
    list: vi.fn().mockResolvedValue({ cases: [], total: 0 }),
    listGroupedByClient: vi
      .fn()
      .mockResolvedValue({ groups: [], clientTotal: 0, caseTotal: 0 }),
    get: vi.fn().mockResolvedValue(null),
    create: vi.fn().mockImplementation(async (_actor, id, values) => ({
      status: "created",
      case: {
        ...values,
        id,
        organizationId: "org-1",
        client: { id: "client-1", name: "BBVA" },
        archivedAt: null,
        createdByUserId: "user-1",
        createdAt: new Date("2026-09-02T10:00:00Z"),
        updatedAt: new Date("2026-09-02T10:00:00Z"),
        team: { members: [], total: 0 },
        followers: { members: [], total: 0 },
      },
    })),
    update: vi.fn().mockResolvedValue({ status: "not_found" }),
    archive: vi.fn().mockResolvedValue({ status: "not_found" }),
    restore: vi.fn().mockResolvedValue({ status: "not_found" }),
    listAssignments: vi
      .fn()
      .mockResolvedValue({ active: [], history: [], historyTotal: 0 }),
    listCandidates: vi.fn().mockResolvedValue([]),
    addAssignments: vi.fn().mockResolvedValue({ status: "updated" }),
    endAssignment: vi.fn().mockResolvedValue({ status: "not_found" }),
    listActivities: vi.fn().mockResolvedValue({ activities: [], total: 0 }),
    ...overrides,
  };
}

describe("case service", () => {
  test("omits procedural fields that do not apply without type or stage", async () => {
    const store = createStore();
    const service = createCaseService(store, () => "case-1");

    await service.create(actor, {
      clientId: " client-1 ",
      identification: "  IR 2000 - DCA BBVA  ",
    });

    expect(store.create).toHaveBeenCalledWith(
      actor,
      "case-1",
      expect.objectContaining({
        clientId: "client-1",
        identification: "IR 2000 - DCA BBVA",
        claimantType: null,
        docketNumber: null,
        status: "in_progress",
        result: null,
        periodKind: null,
        periodStart: null,
        periodEnd: null,
      }),
      { members: [], followers: [] },
    );
  });

  test("defaults a judicial claimant to the case client", async () => {
    const store = createStore();
    const service = createCaseService(store, () => "case-1");

    await service.create(actor, {
      clientId: "client-1",
      identification: "Expediente tributario",
      type: "judicial",
    });

    expect(store.create).toHaveBeenCalledWith(
      actor,
      "case-1",
      expect.objectContaining({ claimantType: "client" }),
      { members: [], followers: [] },
    );
  });

  test("keeps a docket only when the case has a stage", async () => {
    const store = createStore();
    const service = createCaseService(store, () => "case-1");

    await service.create(actor, {
      clientId: "client-1",
      identification: "Expediente tributario",
      type: "administrative",
      docketNumber: "EXP-001",
    });

    expect(store.create).toHaveBeenCalledWith(
      actor,
      "case-1",
      expect.objectContaining({ docketNumber: null, claimantType: null }),
      { members: [], followers: [] },
    );
  });

  test("accepts SUNAT as claimant and a docket for a staged judicial case", async () => {
    const store = createStore();
    const service = createCaseService(store, () => "case-1");

    await service.create(actor, {
      clientId: "client-1",
      identification: "Expediente tributario",
      type: "judicial",
      stage: "judicial_first_instance",
      docketNumber: " EXP-001 ",
      claimantType: "sunat",
    });

    expect(store.create).toHaveBeenCalledWith(
      actor,
      "case-1",
      expect.objectContaining({
        docketNumber: "EXP-001",
        claimantType: "sunat",
      }),
      { members: [], followers: [] },
    );
  });

  test("normalizes a concluded case with period, money, and members", async () => {
    const store = createStore();
    const service = createCaseService(store, () => "case-1");

    await service.create(actor, {
      clientId: "client-1",
      identification: "Expediente tributario",
      type: "judicial",
      subtype: "dca",
      stage: "judicial_first_instance",
      period: { kind: "year", year: 2000 },
      amount: "15500000",
      currency: "PEN",
      status: "concluded",
      result: "founded",
      initialMemberUserIds: ["user-2", "user-2", "user-3"],
      initialFollowerUserIds: ["user-2", "user-4", "user-4"],
    });

    expect(store.create).toHaveBeenCalledWith(
      actor,
      "case-1",
      expect.objectContaining({
        periodKind: "year",
        periodStart: "2000-01-01",
        periodEnd: "2000-12-01",
        amount: "15500000",
        currency: "PEN",
        status: "concluded",
        result: "founded",
      }),
      {
        members: ["user-2", "user-3"],
        followers: ["user-2", "user-4"],
      },
    );
  });

  test("rejects access without active organization membership", async () => {
    const store = createStore({
      hasMembership: vi.fn().mockResolvedValue(false),
    });
    const service = createCaseService(store);

    await expect(service.list(actor, {})).rejects.toEqual(
      new CaseServiceError("FORBIDDEN", "No tienes acceso a este estudio."),
    );
    expect(store.list).not.toHaveBeenCalled();
  });

  test("maps archived mutations to a conflict", async () => {
    const current = {
      id: "case-1",
      organizationId: "org-1",
      clientId: "client-1",
      client: { id: "client-1", name: "BBVA" },
      identification: "Caso",
      type: null,
      subtype: null,
      stage: null,
      entity: null,
      docketNumber: null,
      tax: null,
      periodKind: null,
      periodStart: null,
      periodEnd: null,
      amount: null,
      currency: null,
      claimantType: null,
      disputedMatter: null,
      challengedResolution: null,
      status: "in_progress" as const,
      result: null,
      archivedAt: new Date(),
      createdByUserId: "user-1",
      createdAt: new Date(),
      updatedAt: new Date(),
      team: { members: [], total: 0 },
      followers: { members: [], total: 0 },
    };
    const store = createStore({
      get: vi.fn().mockResolvedValue(current),
      update: vi.fn().mockResolvedValue({ status: "case_archived" }),
    });
    const service = createCaseService(store);

    await expect(
      service.update(actor, "case-1", {
        identification: "Nueva identificación",
      }),
    ).rejects.toEqual(
      new CaseServiceError(
        "CASE_ARCHIVED",
        "Restaura el caso antes de modificarlo.",
      ),
    );
  });
});
