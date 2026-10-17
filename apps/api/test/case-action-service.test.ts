import { describe, expect, test, vi } from "vitest";

import {
  CaseActionServiceError,
  createCaseActionService,
  type CaseActionStore,
} from "../src/case-actions/case-action-service";

const actor = { userId: "user-1", organizationId: "org-1" };
const now = new Date("2026-09-03T12:00:00.000Z");
const record = {
  id: "action-1",
  organizationId: "org-1",
  caseId: "case-1",
  description: "Revisar la sentencia",
  status: "pending" as const,
  assignee: null,
  creator: {
    userId: "user-1",
    fullName: "Cristian Granda",
    alias: "CG",
    avatarColor: null,
    activeStudioMember: true,
    linkable: true,
  },
  completedAt: null,
  completedByUserId: null,
  createdAt: now,
  updatedAt: now,
  archivedAt: null,
};

function store(overrides: Partial<CaseActionStore> = {}): CaseActionStore {
  return {
    hasMembership: vi.fn().mockResolvedValue(true),
    list: vi.fn().mockResolvedValue({ actions: [], total: 0 }),
    create: vi.fn().mockResolvedValue({ status: "created", action: record }),
    update: vi.fn().mockResolvedValue({ status: "updated", action: record }),
    complete: vi.fn().mockResolvedValue({ status: "updated", action: record }),
    reopen: vi.fn().mockResolvedValue({ status: "updated", action: record }),
    archive: vi.fn().mockResolvedValue({ status: "updated", action: record }),
    restore: vi.fn().mockResolvedValue({ status: "updated", action: record }),
    ...overrides,
  };
}

describe("case action service", () => {
  test("creates an unassigned action and trims its description", async () => {
    const adapter = store();
    const service = createCaseActionService(adapter, () => "action-1");

    await service.create(actor, "case-1", {
      description: "  Revisar la sentencia  ",
      assigneeUserId: null,
    });

    expect(adapter.create).toHaveBeenCalledWith(actor, "case-1", "action-1", {
      description: "Revisar la sentencia",
      assigneeUserId: null,
    });
  });

  test.each(["", "   ", "x".repeat(1001)])(
    "rejects invalid descriptions",
    async (description) => {
      await expect(
        createCaseActionService(store()).create(actor, "case-1", {
          description,
        }),
      ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    },
  );

  test("distinguishes omitted assignment from explicit unassignment", async () => {
    const adapter = store();
    const service = createCaseActionService(adapter);
    await service.update(actor, "case-1", "action-1", {
      description: "  Nueva descripción  ",
      expectedUpdatedAt: now.toISOString(),
    });
    expect(adapter.update).toHaveBeenCalledWith(
      actor,
      "case-1",
      "action-1",
      { description: "Nueva descripción" },
      now.toISOString(),
    );

    await service.update(actor, "case-1", "action-1", {
      assigneeUserId: null,
      expectedUpdatedAt: now.toISOString(),
    });
    expect(adapter.update).toHaveBeenLastCalledWith(
      actor,
      "case-1",
      "action-1",
      { assigneeUserId: null },
      now.toISOString(),
    );
  });

  test("maps assignment and concurrency failures", async () => {
    const assignment = createCaseActionService(
      store({
        create: vi.fn().mockResolvedValue({ status: "assignee_not_found" }),
      }),
    );
    await expect(
      assignment.create(actor, "case-1", {
        description: "Acción",
        assigneeUserId: "user-2",
      }),
    ).rejects.toMatchObject({ code: "ASSIGNEE_NOT_FOUND" });

    const conflict = createCaseActionService(
      store({ complete: vi.fn().mockResolvedValue({ status: "conflict" }) }),
    );
    await expect(
      conflict.complete(actor, "case-1", "action-1", now.toISOString()),
    ).rejects.toEqual(
      expect.objectContaining<Partial<CaseActionServiceError>>({
        code: "CONFLICT",
      }),
    );
  });

  test("lists pending actions by default", async () => {
    const adapter = store({
      list: vi.fn().mockResolvedValue({ actions: [record], total: 11 }),
    });
    await expect(
      createCaseActionService(adapter).list(actor, "case-1", {}),
    ).resolves.toMatchObject({
      actions: [record],
      pagination: { page: 1, pageSize: 10, total: 11, totalPages: 2 },
    });
    expect(adapter.list).toHaveBeenCalledWith("org-1", "case-1", {
      status: "pending",
      page: 1,
      pageSize: 10,
    });
  });

  test("passes the combined active scope to the store", async () => {
    const adapter = store({
      list: vi.fn().mockResolvedValue({ actions: [record], total: 1 }),
    });
    await createCaseActionService(adapter).list(actor, "case-1", {
      status: "active",
    });
    expect(adapter.list).toHaveBeenCalledWith("org-1", "case-1", {
      status: "active",
      page: 1,
      pageSize: 10,
    });
  });
});
