import { describe, expect, test, vi } from "vitest";

import {
  ProjectServiceError,
  createProjectService,
  type ProjectStore,
} from "../src/projects/project-service";

const actor = { userId: "user-1", organizationId: "org-1" };

function store(overrides: Partial<ProjectStore> = {}) {
  return {
    hasMembership: vi.fn().mockResolvedValue(true),
    findClient: vi
      .fn()
      .mockResolvedValue({ id: "client-1", name: "Cliente Uno" }),
    list: vi.fn().mockResolvedValue({ projects: [], total: 0 }),
    get: vi.fn().mockResolvedValue(null),
    create: vi.fn().mockResolvedValue({
      status: "created",
      project: {
        id: "project-1",
        organizationId: "org-1",
        clientId: "client-1",
        client: { id: "client-1", name: "Cliente Uno" },
        name: "Consulta",
        type: "consultation",
        status: "draft",
        startDate: "2026-08-12",
        endDate: "2026-08-20",
        internalReference: null,
        description: null,
        archivedAt: null,
        createdAt: new Date("2026-08-12T10:00:00Z"),
        updatedAt: new Date("2026-08-12T10:00:00Z"),
      },
    }),
    update: vi.fn().mockResolvedValue({ status: "not_found" }),
    archive: vi.fn().mockResolvedValue({ status: "not_found" }),
    restore: vi.fn().mockResolvedValue({ status: "not_found" }),
    ...overrides,
  } as unknown as ProjectStore;
}

describe("project period service", () => {
  test("normalizes multiple initial legal events", async () => {
    const projects = store();
    const service = createProjectService(projects, () => "project-1");

    await service.create(actor, {
      name: "  Consulta  ",
      clientId: "client-1",
      type: "consultation",
      startDate: "2026-08-12",
      endDate: "2026-08-20",
      initialLegalEvents: [
        {
          title: "  Audiencia  ",
          date: "2026-08-25",
          description: "  Audiencia confirmada  ",
        },
        { date: "2026-08-28" },
      ],
    });

    expect(projects.create).toHaveBeenCalledWith(
      actor,
      "project-1",
      expect.objectContaining({
        startDate: "2026-08-12",
        endDate: "2026-08-20",
      }),
      expect.any(Array),
      [
        {
          title: "Audiencia",
          date: "2026-08-25",
          description: "Audiencia confirmada",
        },
        {
          title: "Fecha legal",
          date: "2026-08-28",
          description: null,
        },
      ],
      [],
    );
  });

  test("keeps singular initial legal event compatibility", async () => {
    const projects = store();
    const service = createProjectService(projects, () => "project-1");

    await service.create(actor, {
      name: "Consulta",
      clientId: "client-1",
      type: "consultation",
      startDate: "2026-08-12",
      endDate: "2026-08-20",
      initialLegalEvent: { date: "2026-08-25" },
    });

    expect(projects.create).toHaveBeenCalledWith(
      actor,
      "project-1",
      expect.any(Object),
      expect.any(Array),
      [
        {
          title: "Fecha legal",
          date: "2026-08-25",
          description: null,
        },
      ],
      [],
    );
  });

  test("rejects an end date before the project start", async () => {
    const projects = store();
    const service = createProjectService(projects);

    await expect(
      service.create(actor, {
        name: "Consulta",
        clientId: "client-1",
        type: "consultation",
        startDate: "2026-08-20",
        endDate: "2026-08-19",
      }),
    ).rejects.toEqual(
      new ProjectServiceError(
        "INVALID_DATES",
        "Revisa el orden de las fechas del proyecto.",
      ),
    );
    expect(projects.create).not.toHaveBeenCalled();
  });

  test("rejects any initial legal event before the project start", async () => {
    const projects = store();
    const service = createProjectService(projects);

    await expect(
      service.create(actor, {
        name: "Consulta",
        clientId: "client-1",
        type: "consultation",
        startDate: "2026-08-20",
        endDate: "2026-08-25",
        initialLegalEvents: [{ date: "2026-08-21" }, { date: "2026-08-19" }],
      }),
    ).rejects.toMatchObject({ code: "INVALID_DATES" });
    expect(projects.create).not.toHaveBeenCalled();
  });
});
