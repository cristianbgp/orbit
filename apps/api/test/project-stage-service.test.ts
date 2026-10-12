import { describe, expect, test, vi } from "vitest";

import {
  ProjectStageServiceError,
  createProjectStageService,
  type ProjectStageStore,
} from "../src/project-stages/project-stage-service";
import type { ProjectStageRecord } from "../src/project-stages/project-stage-types";

const actor = { userId: "user-1", organizationId: "org-1" };
const now = new Date("2026-08-06T10:00:00.000Z");
const stages: ProjectStageRecord[] = [
  {
    id: "stage-1",
    organizationId: "org-1",
    projectId: "project-1",
    name: "Investigación",
    description: "Reunir fundamentos.",
    position: 0,
    createdAt: now,
    updatedAt: now,
  },
  {
    id: "stage-2",
    organizationId: "org-1",
    projectId: "project-1",
    name: "Estrategia",
    description: null,
    position: 1,
    createdAt: now,
    updatedAt: now,
  },
];

function createStore(
  overrides: Partial<ProjectStageStore> = {},
): ProjectStageStore {
  return {
    getMembershipRole: vi.fn().mockResolvedValue("owner"),
    projectExists: vi.fn().mockResolvedValue(true),
    list: vi.fn().mockResolvedValue(stages),
    create: vi.fn().mockResolvedValue(stages[0]),
    update: vi.fn().mockResolvedValue(stages[0]),
    reorder: vi.fn().mockResolvedValue([...stages].reverse()),
    remove: vi.fn().mockResolvedValue("removed"),
    ...overrides,
  };
}

describe("project stage service", () => {
  test("allows an organization member to read ordered project stages", async () => {
    const store = createStore({
      getMembershipRole: vi.fn().mockResolvedValue("member"),
    });
    const service = createProjectStageService(store);

    await expect(service.list(actor, "project-1")).resolves.toEqual(stages);
    expect(store.list).toHaveBeenCalledWith("org-1", "project-1");
  });

  test("rejects a missing membership before reading the project", async () => {
    const store = createStore({
      getMembershipRole: vi.fn().mockResolvedValue(null),
    });
    const service = createProjectStageService(store);

    await expect(service.list(actor, "project-1")).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    expect(store.projectExists).not.toHaveBeenCalled();
  });

  test("uses tenant-safe not found for an unavailable project", async () => {
    const store = createStore({
      projectExists: vi.fn().mockResolvedValue(false),
    });
    const service = createProjectStageService(store);

    await expect(
      service.list(actor, "project-from-another-org"),
    ).rejects.toEqual(
      new ProjectStageServiceError("NOT_FOUND", "Proyecto no encontrado."),
    );
    expect(store.list).not.toHaveBeenCalled();
  });

  test("allows organization members to mutate stages", async () => {
    const store = createStore({
      getMembershipRole: vi.fn().mockResolvedValue("member"),
    });
    const service = createProjectStageService(store);

    await service.create(actor, "project-1", { name: "Audiencia" });
    await service.update(actor, "project-1", "stage-1", {
      name: "Investigación jurídica",
    });
    await service.reorder(actor, "project-1", {
      stageIds: ["stage-2", "stage-1"],
    });
    await service.remove(actor, "project-1", "stage-1");

    expect(store.projectExists).toHaveBeenCalledWith("org-1", "project-1");
    expect(store.create).toHaveBeenCalled();
    expect(store.update).toHaveBeenCalled();
    expect(store.reorder).toHaveBeenCalled();
    expect(store.remove).toHaveBeenCalled();
  });

  test("forbids stage mutations for users outside the organization", async () => {
    const store = createStore({
      getMembershipRole: vi.fn().mockResolvedValue(null),
    });
    const service = createProjectStageService(store);

    await expect(
      service.create(actor, "project-1", { name: "Audiencia" }),
    ).rejects.toEqual(
      new ProjectStageServiceError(
        "FORBIDDEN",
        "No tienes acceso a este estudio.",
      ),
    );
    expect(store.projectExists).not.toHaveBeenCalled();
    expect(store.create).not.toHaveBeenCalled();
  });

  test("normalizes a manually created stage", async () => {
    const store = createStore();
    const service = createProjectStageService(store, () => "stage-new");

    await service.create(actor, "project-1", {
      name: "  Audiencia  ",
      description: "   ",
    });

    expect(store.create).toHaveBeenCalledWith(actor, "project-1", {
      id: "stage-new",
      name: "Audiencia",
      description: null,
    });
  });

  test("normalizes supplied stage updates", async () => {
    const store = createStore();
    const service = createProjectStageService(store);

    await service.update(actor, "project-1", "stage-1", {
      name: "  Investigación jurídica  ",
      description: "  Preparar expediente  ",
    });

    expect(store.update).toHaveBeenCalledWith(actor, "project-1", "stage-1", {
      name: "Investigación jurídica",
      description: "Preparar expediente",
    });
  });

  test.each([
    ["duplicates", ["stage-1", "stage-1"]],
    ["omissions", ["stage-1"]],
    ["unknown additions", ["stage-1", "stage-other"]],
  ])("rejects reorder %s", async (_case, stageIds) => {
    const store = createStore();
    const service = createProjectStageService(store);

    await expect(
      service.reorder(actor, "project-1", { stageIds }),
    ).rejects.toMatchObject({ code: "INVALID_ORDER" });
    expect(store.reorder).not.toHaveBeenCalled();
  });

  test("reorders the complete current stage set", async () => {
    const reordered = [
      { ...stages[1], position: 0 },
      { ...stages[0], position: 1 },
    ];
    const store = createStore({
      reorder: vi.fn().mockResolvedValue(reordered),
    });
    const service = createProjectStageService(store);

    await expect(
      service.reorder(actor, "project-1", {
        stageIds: ["stage-2", "stage-1"],
      }),
    ).resolves.toEqual(reordered);
    expect(store.reorder).toHaveBeenCalledWith(actor, "project-1", [
      "stage-2",
      "stage-1",
    ]);
  });

  test("rejects a stale order detected by persistence", async () => {
    const store = createStore({ reorder: vi.fn().mockResolvedValue(null) });
    const service = createProjectStageService(store);

    await expect(
      service.reorder(actor, "project-1", {
        stageIds: ["stage-2", "stage-1"],
      }),
    ).rejects.toMatchObject({ code: "INVALID_ORDER" });
  });

  test("uses tenant-safe not found for missing stages", async () => {
    const store = createStore({
      update: vi.fn().mockResolvedValue(null),
      remove: vi.fn().mockResolvedValue("not_found"),
    });
    const service = createProjectStageService(store);

    await expect(
      service.update(actor, "project-1", "stage-other", { name: "Otra" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(
      service.remove(actor, "project-1", "stage-other"),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  test("refuses to delete a stage that still contains task history", async () => {
    const store = createStore({
      remove: vi.fn().mockResolvedValue("in_use"),
    });
    const service = createProjectStageService(store);

    await expect(service.remove(actor, "project-1", "stage-1")).rejects.toEqual(
      new ProjectStageServiceError(
        "CONFLICT",
        "Mueve las tareas de esta etapa antes de eliminarla.",
      ),
    );
  });

  test.each(["create", "update", "reorder", "remove"] as const)(
    "maps archived project %s writes to the shared conflict",
    async (operation) => {
      const store = createStore({
        [operation]: vi
          .fn()
          .mockResolvedValue(
            operation === "remove"
              ? "project_archived"
              : { status: "project_archived" },
          ),
      });
      const service = createProjectStageService(store);

      const action =
        operation === "create"
          ? service.create(actor, "project-1", { name: "Audiencia" })
          : operation === "update"
            ? service.update(actor, "project-1", "stage-1", {
                name: "Audiencia",
              })
            : operation === "reorder"
              ? service.reorder(actor, "project-1", {
                  stageIds: ["stage-1", "stage-2"],
                })
              : service.remove(actor, "project-1", "stage-1");

      await expect(action).rejects.toEqual(
        new ProjectStageServiceError(
          "PROJECT_ARCHIVED",
          "El proyecto está archivado. Restáuralo para realizar cambios.",
        ),
      );
    },
  );
});
