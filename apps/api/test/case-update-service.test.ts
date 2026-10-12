import { describe, expect, test, vi } from "vitest";

import {
  CaseUpdateServiceError,
  createCaseUpdateService,
  type CaseUpdateStore,
} from "../src/case-updates/case-update-service";

const actor = { userId: "user-1", organizationId: "org-1" };
const createdAt = new Date("2026-09-03T12:00:00.000Z");
const record = {
  id: "update-1",
  organizationId: "org-1",
  caseId: "case-1",
  date: "2026-08-21",
  description: "Sentencia de primera instancia",
  kind: "update" as const,
  creator: {
    userId: "user-1",
    fullName: "Cristian Granda",
    alias: "CG",
    avatarColor: "#4057ED",
    activeStudioMember: true,
    linkable: true,
  },
  createdAt,
  updatedAt: createdAt,
  archivedAt: null,
};

function createStore(
  overrides: Partial<CaseUpdateStore> = {},
): CaseUpdateStore {
  return {
    hasMembership: vi.fn().mockResolvedValue(true),
    list: vi.fn().mockResolvedValue({ updates: [], total: 0 }),
    create: vi.fn().mockResolvedValue({ status: "created", update: record }),
    update: vi.fn().mockResolvedValue({ status: "updated", update: record }),
    archive: vi.fn().mockResolvedValue({ status: "updated", update: record }),
    restore: vi.fn().mockResolvedValue({ status: "updated", update: record }),
    previewMoveAllToBackground: vi
      .fn()
      .mockResolvedValue({ movedCount: 3, caseCount: 2 }),
    moveAllToBackground: vi
      .fn()
      .mockResolvedValue({ status: "updated", movedCount: 3, caseCount: 2 }),
    ...overrides,
  };
}

describe("case update service", () => {
  test("lists active updates with explicit pagination defaults", async () => {
    const store = createStore({
      list: vi.fn().mockResolvedValue({ updates: [record], total: 11 }),
    });
    const service = createCaseUpdateService(store);

    await expect(service.list(actor, "case-1", {})).resolves.toEqual({
      updates: [record],
      pagination: { page: 1, pageSize: 10, total: 11, totalPages: 2 },
    });
    expect(store.list).toHaveBeenCalledWith("org-1", "case-1", {
      status: "active",
      page: 1,
      pageSize: 10,
    });
  });

  test("forwards the requested update classification when listing", async () => {
    const store = createStore();
    const service = createCaseUpdateService(store);

    await service.list(actor, "case-1", {
      kind: "background",
    } as never);

    expect(store.list).toHaveBeenCalledWith("org-1", "case-1", {
      status: "active",
      kind: "background",
      page: 1,
      pageSize: 10,
    });
  });

  test("trims a valid description before creation", async () => {
    const store = createStore();
    const service = createCaseUpdateService(store, () => "update-1");

    await expect(
      service.create(actor, "case-1", {
        date: "2026-08-21",
        description: "  Sentencia de primera instancia  ",
      }),
    ).resolves.toEqual(record);
    expect(store.create).toHaveBeenCalledWith(actor, "case-1", "update-1", {
      date: "2026-08-21",
      description: "Sentencia de primera instancia",
      kind: "update",
    });
  });

  test.each(["", "   ", "x".repeat(5001)])(
    "rejects an invalid description before persistence",
    async (description) => {
      const service = createCaseUpdateService(createStore());

      await expect(
        service.create(actor, "case-1", {
          date: "2026-08-21",
          description,
        }),
      ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    },
  );

  test("rejects an invalid calendar date before persistence", async () => {
    const service = createCaseUpdateService(createStore());

    await expect(
      service.create(actor, "case-1", {
        date: "2026-02-30",
        description: "Actuación",
      }),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });

  test("normalizes editable fields and forwards the expected version", async () => {
    const store = createStore();
    const service = createCaseUpdateService(store);

    await service.update(actor, "case-1", "update-1", {
      description: "  Resolución notificada  ",
      expectedUpdatedAt: createdAt.toISOString(),
    });

    expect(store.update).toHaveBeenCalledWith(
      actor,
      "case-1",
      "update-1",
      { description: "Resolución notificada" },
      createdAt.toISOString(),
    );
  });

  test("allows an update to move between novelty and background", async () => {
    const store = createStore();
    const service = createCaseUpdateService(store);

    await service.update(actor, "case-1", "update-1", {
      kind: "background",
      expectedUpdatedAt: createdAt.toISOString(),
    });

    expect(store.update).toHaveBeenCalledWith(
      actor,
      "case-1",
      "update-1",
      { kind: "background" },
      createdAt.toISOString(),
    );
  });

  test("previews and moves all organizational novelties through the store", async () => {
    const store = createStore();
    const service = createCaseUpdateService(store);

    await expect(service.previewMoveAllToBackground(actor)).resolves.toEqual({
      movedCount: 3,
      caseCount: 2,
    });
    const result = await service.moveAllToBackground(actor);

    expect(result).toEqual({ movedCount: 3, caseCount: 2 });
    expect(store.previewMoveAllToBackground).toHaveBeenCalledWith("org-1");
    expect(store.moveAllToBackground).toHaveBeenCalledWith(actor);
  });

  test.each([
    ["conflict", "CONFLICT"],
    ["case_archived", "CASE_ARCHIVED"],
    ["not_found", "NOT_FOUND"],
  ] as const)("maps %s lifecycle failures", async (status, code) => {
    const service = createCaseUpdateService(
      createStore({ archive: vi.fn().mockResolvedValue({ status }) }),
    );

    await expect(
      service.archive(actor, "case-1", "update-1", createdAt.toISOString()),
    ).rejects.toEqual(
      expect.objectContaining<Partial<CaseUpdateServiceError>>({ code }),
    );
  });

  test("rejects actors without an active studio membership", async () => {
    const service = createCaseUpdateService(
      createStore({ hasMembership: vi.fn().mockResolvedValue(false) }),
    );

    await expect(service.list(actor, "case-1", {})).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });
});
