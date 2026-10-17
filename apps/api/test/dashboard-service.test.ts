import { describe, expect, test, vi } from "vitest";

import {
  createDashboardService,
  DashboardServiceError,
  type DashboardStore,
} from "../src/dashboard/dashboard-service";
import type { DashboardActivityPreview } from "../src/dashboard/dashboard-types";

const actor = { userId: "user-1", organizationId: "org-1" };
const activity: DashboardActivityPreview = {
  source: "project",
  case: null,
  id: "activity-1",
  organizationId: "org-1",
  projectId: "project-1",
  project: {
    id: "project-1",
    name: "Apelación Constructora",
    status: "completed",
    archivedAt: null,
  },
  type: "project.status_changed",
  actor: {
    userId: "user-1",
    alias: "CG",
    avatarColor: "#11182b",
    nameSnapshot: "Cristian Granda",
    activeStudioMember: true,
    linkable: true,
  },
  subject: null,
  details: { previousStatus: "active", newStatus: "completed" },
  createdAt: new Date("2026-08-10T15:00:00.000Z"),
};

function createStore(overrides: Partial<DashboardStore> = {}): DashboardStore {
  return {
    findMemberContext: vi.fn().mockResolvedValue({ timeZone: "America/Lima" }),
    listActivity: vi.fn().mockResolvedValue({
      activities: [activity],
      hasMore: true,
    }),
    ...overrides,
  };
}

describe("dashboard activity service", () => {
  test("rejects a user outside the active organization", async () => {
    const store = createStore({
      findMemberContext: vi.fn().mockResolvedValue(null),
    });
    const service = createDashboardService(store);

    await expect(service.activity(actor, { pageSize: 25 })).rejects.toEqual(
      new DashboardServiceError(
        "FORBIDDEN",
        "No tienes acceso a este estudio.",
      ),
    );
    expect(store.listActivity).not.toHaveBeenCalled();
  });

  test("returns studio activity with an opaque next cursor", async () => {
    const store = createStore();
    const service = createDashboardService(store);

    await expect(service.activity(actor, { pageSize: 25 })).resolves.toEqual({
      timeZone: "America/Lima",
      activities: [activity],
      nextCursor: "WyIyMDI2LTA4LTEwVDE1OjAwOjAwLjAwMFoiLCJhY3Rpdml0eS0xIl0",
    });
    expect(store.listActivity).toHaveBeenCalledWith("org-1", {
      limit: 25,
      cursor: null,
    });
  });

  test("decodes a valid activity cursor before loading an older page", async () => {
    const store = createStore({
      listActivity: vi.fn().mockResolvedValue({
        activities: [],
        hasMore: false,
      }),
    });
    const service = createDashboardService(store);

    await service.activity(actor, {
      pageSize: 10,
      cursor: "WyIyMDI2LTA4LTEwVDE1OjAwOjAwLjAwMFoiLCJhY3Rpdml0eS0xIl0",
    });

    expect(store.listActivity).toHaveBeenCalledWith("org-1", {
      limit: 10,
      cursor: {
        createdAt: new Date("2026-08-10T15:00:00.000Z"),
        id: "activity-1",
      },
    });
  });

  test("rejects a malformed activity cursor", async () => {
    const store = createStore();
    const service = createDashboardService(store);

    await expect(
      service.activity(actor, { pageSize: 25, cursor: "not-a-cursor" }),
    ).rejects.toEqual(
      new DashboardServiceError("INVALID_CURSOR", "Cursor inválido."),
    );
    expect(store.listActivity).not.toHaveBeenCalled();
  });
});
