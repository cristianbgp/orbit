import { describe, expect, test, vi } from "vitest";

import {
  createMyWorkService,
  MyWorkServiceError,
  type MyWorkStore,
} from "../src/my-work/my-work-service";

const actor = { userId: "user-1", organizationId: "org-1" };

function createStore(overrides: Partial<MyWorkStore> = {}): MyWorkStore {
  return {
    findMemberContext: vi.fn().mockResolvedValue({ timeZone: "America/Lima" }),
    listAssignedTasks: vi.fn().mockResolvedValue({
      today: "2026-08-10",
      tasks: [],
      pagination: { page: 1, pageSize: 25, total: 0, totalPages: 0 },
    }),
    listSupervisedProjects: vi.fn().mockResolvedValue({
      today: "2026-08-10",
      projects: [],
      pagination: { page: 1, pageSize: 25, total: 0, totalPages: 0 },
    }),
    listAssignedCaseActions: vi.fn().mockResolvedValue({
      actions: [],
      pagination: { page: 1, pageSize: 25, total: 0, totalPages: 0 },
    }),
    ...overrides,
  };
}

describe("my work service", () => {
  test("rejects a user outside the active organization", async () => {
    const store = createStore({
      findMemberContext: vi.fn().mockResolvedValue(null),
    });
    const service = createMyWorkService(store);

    await expect(service.assignedTasks(actor, {})).rejects.toEqual(
      new MyWorkServiceError("FORBIDDEN", "No tienes acceso a este estudio."),
    );
    expect(store.listAssignedTasks).not.toHaveBeenCalled();
  });

  test("normalizes assigned-task filters and uses the organization-local day", async () => {
    const store = createStore();
    const service = createMyWorkService(
      store,
      () => new Date("2026-08-11T03:30:00.000Z"),
    );

    await service.assignedTasks(actor, {
      page: 2,
      pageSize: 10,
      search: "  apelación  ",
      projectId: ["p-2", "p-1", "p-2"],
      status: ["blocked", "pending", "blocked"],
      includeCompleted: true,
    });

    expect(store.listAssignedTasks).toHaveBeenCalledWith("org-1", "user-1", {
      page: 2,
      pageSize: 10,
      search: "apelación",
      projectIds: ["p-2", "p-1"],
      statuses: ["blocked", "pending"],
      dateFrom: undefined,
      dateTo: undefined,
      includeCompleted: true,
      today: "2026-08-10",
      weekEnd: "2026-08-16",
    });
  });

  test("uses independent defaults and a bounded supervision preview", async () => {
    const store = createStore();
    const service = createMyWorkService(
      store,
      () => new Date("2026-08-10T18:00:00.000Z"),
    );

    await service.supervision(actor, {});

    expect(store.listSupervisedProjects).toHaveBeenCalledWith(
      "org-1",
      "user-1",
      {
        page: 1,
        pageSize: 25,
        search: undefined,
        projectIds: [],
        statuses: [],
        dateFrom: undefined,
        dateTo: undefined,
        includeCompleted: false,
        today: "2026-08-10",
        weekEnd: "2026-08-16",
        previewLimit: 5,
      },
    );
  });

  test("normalizes filters for assigned case actions", async () => {
    const store = createStore();
    const service = createMyWorkService(store);
    await service.caseActions(actor, {
      search: "  escrito ",
      clientId: ["c-1", "c-1"],
      caseId: ["case-1"],
      type: ["judicial"],
      includeCompleted: true,
    });
    expect(store.listAssignedCaseActions).toHaveBeenCalledWith(
      "org-1",
      "user-1",
      {
        page: 1,
        pageSize: 25,
        search: "escrito",
        clientIds: ["c-1"],
        caseIds: ["case-1"],
        types: ["judicial"],
        includeCompleted: true,
      },
    );
  });

  test.each([
    ["2026-08-10", "2026-08-16"],
    ["2026-08-16", "2026-08-16"],
    ["2026-08-31", "2026-09-06"],
    ["2026-12-31", "2027-01-03"],
  ])(
    "uses the Monday-Sunday week containing %s",
    async (localDate, expectedWeekEnd) => {
      const store = createStore();
      const service = createMyWorkService(
        store,
        () => new Date(`${localDate}T18:00:00.000Z`),
      );

      await service.assignedTasks(actor, {});

      expect(store.listAssignedTasks).toHaveBeenCalledWith(
        "org-1",
        "user-1",
        expect.objectContaining({
          today: localDate,
          weekEnd: expectedWeekEnd,
        }),
      );
    },
  );
});
