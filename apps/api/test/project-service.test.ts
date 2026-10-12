import { describe, expect, test, vi } from "vitest";

import {
  ProjectServiceError,
  createProjectService,
  type ProjectStore,
} from "../src/projects/project-service";
import type { ProjectRecord } from "../src/projects/project-types";

const actor = { userId: "user-1", organizationId: "org-1" };

const project: ProjectRecord = {
  id: "project-1",
  organizationId: "org-1",
  clientId: "client-1",
  client: { id: "client-1", name: "Construcciones del Sur S.A." },
  name: "Recurso de apelación",
  type: "written_submission",
  status: "draft",
  startDate: "2026-08-06",
  endDate: "2026-08-14",
  internalReference: null,
  description: null,
  archivedAt: null,
  createdAt: new Date("2026-08-06T10:00:00.000Z"),
  updatedAt: new Date("2026-08-06T10:00:00.000Z"),
};

function createStore(overrides: Partial<ProjectStore> = {}): ProjectStore {
  return {
    hasMembership: vi.fn().mockResolvedValue(true),
    findClient: vi.fn().mockResolvedValue(project.client),
    list: vi.fn().mockResolvedValue({ projects: [], total: 0 }),
    listGroupedByClient: vi.fn().mockResolvedValue({
      groups: [],
      clientTotal: 0,
      projectTotal: 0,
    }),
    get: vi.fn().mockResolvedValue(null),
    create: vi.fn(),
    update: vi.fn().mockResolvedValue({ status: "not_found" }),
    archive: vi.fn().mockResolvedValue({ status: "not_found" }),
    restore: vi.fn().mockResolvedValue({ status: "not_found" }),
    ...overrides,
  };
}

describe("project service", () => {
  test("rejects access before reading projects when membership is absent", async () => {
    const store = createStore({
      hasMembership: vi.fn().mockResolvedValue(false),
    });
    const service = createProjectService(store);

    await expect(service.list(actor, {})).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    expect(store.list).not.toHaveBeenCalled();
  });

  test("rejects grouped access before reading client portfolios", async () => {
    const store = createStore({
      hasMembership: vi.fn().mockResolvedValue(false),
    });
    const service = createProjectService(store);

    await expect(service.listGroupedByClient(actor, {})).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    expect(store.listGroupedByClient).not.toHaveBeenCalled();
  });

  test("normalizes project filters and returns page metadata", async () => {
    const store = createStore({
      list: vi.fn().mockResolvedValue({ projects: [], total: 52 }),
    });
    const service = createProjectService(store);

    await expect(
      service.list(actor, {
        search: "  Construcciones  ",
        type: ["written_submission", "written_submission", "consultation"],
        status: ["active", "active"],
        client: [" client-1 ", "client-1"],
        member: [" user-1 ", "user-2", "user-1"],
      }),
    ).resolves.toEqual({
      projects: [],
      pagination: { page: 1, pageSize: 25, total: 52, totalPages: 3 },
    });
    expect(store.list).toHaveBeenCalledWith("org-1", {
      search: "Construcciones",
      types: ["written_submission", "consultation"],
      statuses: ["active"],
      clientIds: ["client-1"],
      memberUserIds: ["user-1", "user-2"],
      view: undefined,
      orderBy: "endDate",
      order: "asc",
      page: 1,
      pageSize: 25,
    });
  });

  test("preserves an explicit project order", async () => {
    const store = createStore();
    const service = createProjectService(store);

    await service.list(actor, {
      view: "archived",
      orderBy: "name",
      order: "desc",
    });

    expect(store.list).toHaveBeenCalledWith("org-1", {
      search: undefined,
      types: undefined,
      statuses: undefined,
      clientIds: undefined,
      memberUserIds: undefined,
      view: "archived",
      orderBy: "name",
      order: "desc",
      page: 1,
      pageSize: 25,
    });
  });

  test.each([
    ["current", "endDate", "asc"],
    ["completed", "endDate", "desc"],
    ["archived", "archivedAt", "desc"],
  ] as const)(
    "applies the %s lifecycle view default order",
    async (view, orderBy, order) => {
      const store = createStore();
      const service = createProjectService(store);

      await service.list(actor, { view });

      expect(store.list).toHaveBeenCalledWith("org-1", {
        search: undefined,
        types: undefined,
        statuses: undefined,
        clientIds: undefined,
        memberUserIds: undefined,
        view,
        orderBy,
        order,
        page: 1,
        pageSize: 25,
      });
    },
  );

  test("normalizes grouped filters and paginates complete client groups", async () => {
    const groups = [{ client: project.client, projects: [project] }];
    const listGroupedByClient = vi.fn().mockResolvedValue({
      groups,
      clientTotal: 12,
      projectTotal: 37,
    });
    const groupedService = createProjectService({
      ...createStore(),
      listGroupedByClient,
    });

    await expect(
      groupedService.listGroupedByClient(actor, {
        search: "  Construcciones  ",
        status: ["active"],
        page: 2,
      }),
    ).resolves.toEqual({
      groups,
      pagination: { page: 2, pageSize: 10, total: 12, totalPages: 2 },
      projectTotal: 37,
    });
    expect(listGroupedByClient).toHaveBeenCalledWith("org-1", {
      search: "Construcciones",
      types: undefined,
      statuses: ["active"],
      clientIds: undefined,
      memberUserIds: undefined,
      view: undefined,
      orderBy: "endDate",
      order: "asc",
      page: 2,
      pageSize: 10,
    });
  });

  test("normalizes optional values and defaults status when creating", async () => {
    const store = createStore({
      create: vi.fn().mockResolvedValue({ status: "created", project }),
    });
    const ids = [
      "project-1",
      "stage-1",
      "stage-2",
      "stage-3",
      "stage-4",
      "stage-5",
      "stage-6",
    ];
    const service = createProjectService(
      store,
      vi.fn(() => ids.shift() ?? "unexpected-id"),
    );

    await expect(
      service.create(actor, {
        name: "  Recurso de apelación  ",
        clientId: "client-1",
        type: "written_submission",
        startDate: "2026-08-06",
        endDate: "2026-08-14",
        initialLegalEvent: {
          title: "  Audiencia legal  ",
          date: "2026-08-17",
          description: "  Revisar cargo  ",
        },
        initialAssignments: [
          { userId: "user-2", responsibility: "member" },
          { userId: "user-3", responsibility: "responsible" },
        ],
        internalReference: "  ",
        description: "  Preparar recurso  ",
      }),
    ).resolves.toEqual(project);

    expect(store.findClient).toHaveBeenCalledWith("org-1", "client-1");
    expect(store.create).toHaveBeenCalledWith(
      actor,
      "project-1",
      {
        clientId: "client-1",
        name: "Recurso de apelación",
        type: "written_submission",
        status: "draft",
        startDate: "2026-08-06",
        endDate: "2026-08-14",
        internalReference: null,
        description: "Preparar recurso",
      },
      [
        {
          id: "stage-1",
          name: "Investigación y análisis",
          description:
            "Revisión de antecedentes. Búsqueda de jurisprudencia y doctrina.",
          position: 0,
        },
        {
          id: "stage-2",
          name: "Estrategia",
          description: "Elaboración de presentación.",
          position: 1,
        },
        {
          id: "stage-3",
          name: "Redacción",
          description: "Preparación de esquema. Elaboración de escrito.",
          position: 2,
        },
        {
          id: "stage-4",
          name: "Revisión de socios",
          description: "Incorporación de ajustes de socios.",
          position: 3,
        },
        {
          id: "stage-5",
          name: "Envío al cliente",
          description: "Trazar envío y seguimiento de conformidad.",
          position: 4,
        },
        {
          id: "stage-6",
          name: "Presentación",
          description: "Presentar y enviar cargo al cliente.",
          position: 5,
        },
      ],
      [
        {
          title: "Audiencia legal",
          date: "2026-08-17",
          description: "Revisar cargo",
        },
      ],
      [
        { userId: "user-2", responsibility: "member" },
        { userId: "user-3", responsibility: "responsible" },
      ],
    );
  });

  test("creates Otro projects without default stages", async () => {
    const otherProject = { ...project, type: "other" as const };
    const store = createStore({
      create: vi.fn().mockResolvedValue({
        status: "created",
        project: otherProject,
      }),
    });
    const service = createProjectService(store, () => "project-1");

    await service.create(actor, {
      name: "Proyecto especial",
      clientId: "client-1",
      type: "other",
      startDate: "2026-08-06",
      endDate: "2026-08-14",
    });

    expect(store.create).toHaveBeenCalledWith(
      actor,
      "project-1",
      expect.objectContaining({ type: "other" }),
      [],
      [],
      [],
    );
  });

  test.each([
    {
      startDate: "2026-08-15",
      endDate: "2026-08-14",
    },
  ])("rejects invalid project date order for %o", async (dates) => {
    const store = createStore();
    const service = createProjectService(store);

    await expect(
      service.create(actor, {
        name: "Recurso de apelación",
        clientId: "client-1",
        type: "written_submission",
        ...dates,
      }),
    ).rejects.toEqual(
      new ProjectServiceError(
        "INVALID_DATES",
        "Revisa el orden de las fechas del proyecto.",
      ),
    );
    expect(store.create).not.toHaveBeenCalled();
  });

  test("rejects a client outside the active organization", async () => {
    const store = createStore({
      findClient: vi.fn().mockResolvedValue(null),
    });
    const service = createProjectService(store);

    await expect(
      service.create(actor, {
        name: "Demanda laboral",
        clientId: "client-from-another-org",
        type: "consultation",
        startDate: "2026-08-06",
        endDate: "2026-08-14",
      }),
    ).rejects.toEqual(
      new ProjectServiceError("CLIENT_NOT_FOUND", "Cliente no disponible."),
    );
  });

  test("returns tenant-safe not found when loading an absent project", async () => {
    const store = createStore({ get: vi.fn().mockResolvedValue(null) });
    const service = createProjectService(store);

    await expect(
      service.get(actor, "project-from-another-org"),
    ).rejects.toEqual(
      new ProjectServiceError("NOT_FOUND", "Proyecto no encontrado."),
    );
  });

  test("validates the complete date set after a partial update", async () => {
    const store = createStore({
      update: vi.fn().mockResolvedValue({ status: "invalid_dates" }),
    });
    const service = createProjectService(store);

    await expect(
      service.update(actor, "project-1", {
        endDate: "2026-08-18",
      }),
    ).rejects.toMatchObject({ code: "INVALID_DATES" });
    expect(store.update).toHaveBeenCalledWith(actor, "project-1", {
      endDate: "2026-08-18",
    });
  });

  test("validates and normalizes a replacement client during update", async () => {
    const updated = {
      ...project,
      clientId: "client-2",
      client: { id: "client-2", name: "Inversiones Andina" },
      description: "Nueva descripción",
    };
    const store = createStore({
      get: vi.fn().mockResolvedValue(project),
      findClient: vi.fn().mockResolvedValue(updated.client),
      update: vi
        .fn()
        .mockResolvedValue({ status: "updated", project: updated }),
    });
    const service = createProjectService(store);

    await expect(
      service.update(actor, "project-1", {
        clientId: "client-2",
        description: "  Nueva descripción  ",
      }),
    ).resolves.toEqual(updated);
    expect(store.findClient).toHaveBeenCalledWith("org-1", "client-2");
    expect(store.update).toHaveBeenCalledWith(actor, "project-1", {
      clientId: "client-2",
      description: "Nueva descripción",
    });
    expect(store.create).not.toHaveBeenCalled();
  });

  test("returns tenant-safe not found when updating an absent project", async () => {
    const store = createStore({
      update: vi.fn().mockResolvedValue({ status: "not_found" }),
    });
    const service = createProjectService(store);

    await expect(
      service.update(actor, "project-from-another-org", { status: "active" }),
    ).rejects.toEqual(
      new ProjectServiceError("NOT_FOUND", "Proyecto no encontrado."),
    );
    expect(store.update).toHaveBeenCalledWith(
      actor,
      "project-from-another-org",
      { status: "active" },
    );
  });

  test("rejects moving a project start past an active task start", async () => {
    const store = createStore({
      get: vi.fn().mockResolvedValue(project),
      update: vi.fn().mockResolvedValue({ status: "invalid_task_start" }),
    });
    const service = createProjectService(store);

    await expect(
      service.update(actor, "project-1", { startDate: "2026-08-08" }),
    ).rejects.toEqual(
      new ProjectServiceError(
        "INVALID_DATES",
        "El inicio del proyecto no puede ser posterior al inicio planificado de una tarea activa.",
      ),
    );
  });

  test("maps archived project writes to a stable conflict", async () => {
    const store = createStore({
      update: vi.fn().mockResolvedValue({ status: "project_archived" }),
    });
    const service = createProjectService(store);

    await expect(
      service.update(actor, "project-1", { status: "completed" }),
    ).rejects.toEqual(
      new ProjectServiceError(
        "PROJECT_ARCHIVED",
        "El proyecto está archivado. Restáuralo para realizar cambios.",
      ),
    );
  });

  test("archives and restores a project through actor-aware writes", async () => {
    const archived = {
      ...project,
      archivedAt: new Date("2026-08-10T12:00:00.000Z"),
    };
    const store = createStore({
      archive: vi.fn().mockResolvedValue({
        status: "updated",
        project: archived,
      }),
      restore: vi.fn().mockResolvedValue({
        status: "updated",
        project,
      }),
    });
    const service = createProjectService(store);

    await expect(service.archive(actor, "project-1")).resolves.toEqual(
      archived,
    );
    await expect(service.restore(actor, "project-1")).resolves.toEqual(project);
    expect(store.archive).toHaveBeenCalledWith(actor, "project-1");
    expect(store.restore).toHaveBeenCalledWith(actor, "project-1");
  });

  test.each([
    ["archive", "El proyecto ya está archivado."],
    ["restore", "El proyecto no está archivado."],
  ] as const)(
    "maps repeated %s requests to an archive conflict",
    async (method, message) => {
      const store = createStore({
        [method]: vi.fn().mockResolvedValue({ status: "archive_conflict" }),
      });
      const service = createProjectService(store);

      await expect(service[method](actor, "project-1")).rejects.toEqual(
        new ProjectServiceError("PROJECT_ARCHIVE_CONFLICT", message),
      );
    },
  );
});
