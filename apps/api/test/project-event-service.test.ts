import { describe, expect, test, vi } from "vitest";

import {
  ProjectEventServiceError,
  createProjectEventService,
  type ProjectEventStore,
} from "../src/project-events/project-event-service";

const actor = { userId: "user-1", organizationId: "org-1" };

function store(overrides: Partial<ProjectEventStore> = {}): ProjectEventStore {
  return {
    hasMembership: vi.fn().mockResolvedValue(true),
    list: vi.fn().mockResolvedValue({ events: [], total: 0 }),
    create: vi.fn().mockResolvedValue({ status: "not_found" }),
    update: vi.fn().mockResolvedValue({ status: "not_found" }),
    remove: vi.fn().mockResolvedValue({ status: "not_found" }),
    ...overrides,
  };
}

describe("project event service", () => {
  test("normalizes pagination and lists chronologically", async () => {
    const events = store({
      list: vi.fn().mockResolvedValue({ events: [], total: 26 }),
    });
    const service = createProjectEventService(events);

    await expect(service.list(actor, "project-1", {})).resolves.toEqual({
      events: [],
      pagination: { page: 1, pageSize: 25, total: 26, totalPages: 2 },
    });
    expect(events.list).toHaveBeenCalledWith("org-1", "project-1", {
      page: 1,
      pageSize: 25,
    });
  });

  test("normalizes legal event input and permits a date after project end", async () => {
    const record = {
      id: "event-1",
      organizationId: "org-1",
      projectId: "project-1",
      title: "Audiencia",
      type: "legal" as const,
      date: "2026-09-10",
      description: null,
      createdByUserId: "user-1",
      createdAt: new Date("2026-08-12T10:00:00Z"),
      updatedAt: new Date("2026-08-12T10:00:00Z"),
    };
    const events = store({
      create: vi.fn().mockResolvedValue({ status: "created", event: record }),
    });
    const service = createProjectEventService(events, () => "event-1");

    await expect(
      service.create(actor, "project-1", {
        title: "  Audiencia  ",
        type: "legal",
        date: "2026-09-10",
        description: "  ",
      }),
    ).resolves.toEqual(record);
    expect(events.create).toHaveBeenCalledWith(actor, "project-1", "event-1", {
      title: "Audiencia",
      type: "legal",
      date: "2026-09-10",
      description: null,
    });
  });

  test("maps a date before project start to validation", async () => {
    const events = store({
      create: vi.fn().mockResolvedValue({ status: "invalid_date" }),
    });
    const service = createProjectEventService(events);

    await expect(
      service.create(actor, "project-1", {
        title: "Audiencia",
        type: "legal",
        date: "2026-08-01",
      }),
    ).rejects.toEqual(
      new ProjectEventServiceError(
        "VALIDATION_ERROR",
        "El evento no puede ser anterior al inicio del proyecto.",
      ),
    );
  });

  test("maps archived mutations to the shared project conflict", async () => {
    const events = store({
      remove: vi.fn().mockResolvedValue({ status: "project_archived" }),
    });
    const service = createProjectEventService(events);

    await expect(
      service.remove(actor, "project-1", "event-1"),
    ).rejects.toMatchObject({
      code: "PROJECT_ARCHIVED",
    });
  });
});
