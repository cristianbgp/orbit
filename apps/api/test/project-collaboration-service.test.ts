import { describe, expect, test, vi } from "vitest";

import {
  createProjectCollaborationService,
  type ProjectCollaborationStore,
} from "../src/project-collaboration/project-collaboration-service";

const actor = { userId: "user-1", organizationId: "org-1" };
const activeActor = {
  memberId: "member-1",
  userId: "user-1",
  organizationId: "org-1",
  role: "member",
  name: "Ana Torres",
  email: "ana@orbit.pe",
};

const assignment = {
  id: "assignment-1",
  organizationId: "org-1",
  projectId: "project-1",
  userId: "user-2",
  userName: "Luis Ramos",
  userEmail: "luis@orbit.pe",
  responsibility: "responsible" as const,
  assignedByUserId: "user-1",
  assignedByName: "Ana Torres",
  assignedAt: new Date("2026-08-06T20:00:00.000Z"),
  endedAt: null,
  endedByUserId: null,
  endedByName: null,
  endReason: null,
};

function createStore(
  overrides: Partial<ProjectCollaborationStore> = {},
): ProjectCollaborationStore {
  return {
    findActiveMember: vi.fn().mockResolvedValue(activeActor),
    listAssignments: vi.fn().mockResolvedValue({
      projectExists: true,
      active: [],
      history: [],
      historyTotal: 0,
    }),
    listCandidates: vi.fn().mockResolvedValue({
      projectExists: true,
      candidates: [],
      total: 0,
    }),
    addAssignments: vi
      .fn()
      .mockResolvedValue({ status: "created", assignments: [assignment] }),
    changeResponsibility: vi
      .fn()
      .mockResolvedValue({ status: "updated", assignment }),
    endAssignment: vi.fn().mockResolvedValue({ status: "ended", assignment }),
    listActivities: vi.fn().mockResolvedValue({
      projectExists: true,
      activities: [],
      total: 0,
    }),
    removeOrganizationMember: vi.fn().mockResolvedValue({
      status: "removed",
      member: { id: "member-2", userId: "user-2", name: "Luis Ramos" },
    }),
    ...overrides,
  };
}

describe("project collaboration service", () => {
  test("rejects every operation when the actor is not an active studio member", async () => {
    const store = createStore({
      findActiveMember: vi.fn().mockResolvedValue(null),
    });
    const service = createProjectCollaborationService(store);

    await expect(
      service.listAssignments(actor, "project-1", {}),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(store.listAssignments).not.toHaveBeenCalled();
  });

  test("allows several assignments to be responsible and derives the actor from membership", async () => {
    const store = createStore();
    const service = createProjectCollaborationService(store);

    await service.addAssignments(actor, "project-1", [
      { userId: "user-2", responsibility: "responsible" },
      { userId: "user-3", responsibility: "responsible" },
    ]);

    expect(store.addAssignments).toHaveBeenCalledWith({
      actor: activeActor,
      projectId: "project-1",
      assignments: [
        { userId: "user-2", responsibility: "responsible" },
        { userId: "user-3", responsibility: "responsible" },
      ],
    });
  });

  test("rejects duplicate users in one assignment batch before persistence", async () => {
    const store = createStore();
    const service = createProjectCollaborationService(store);

    await expect(
      service.addAssignments(actor, "project-1", [
        { userId: "user-2", responsibility: "member" },
        { userId: "user-2", responsibility: "responsible" },
      ]),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    expect(store.addAssignments).not.toHaveBeenCalled();
  });

  test.each([
    "addAssignments",
    "changeResponsibility",
    "endAssignment",
  ] as const)(
    "maps archived project %s writes to the shared conflict",
    async (operation) => {
      const store = createStore({
        [operation]: vi.fn().mockResolvedValue({ status: "project_archived" }),
      });
      const service = createProjectCollaborationService(store);

      const action =
        operation === "addAssignments"
          ? service.addAssignments(actor, "project-1", [
              { userId: "user-2", responsibility: "member" },
            ])
          : operation === "changeResponsibility"
            ? service.changeResponsibility(
                actor,
                "project-1",
                "assignment-1",
                "member",
              )
            : service.endAssignment(actor, "project-1", "assignment-1");

      await expect(action).rejects.toMatchObject({
        code: "PROJECT_ARCHIVED",
        message:
          "El proyecto está archivado. Restáuralo para realizar cambios.",
      });
    },
  );

  test("normalizes candidate search and pagination", async () => {
    const store = createStore({
      listCandidates: vi.fn().mockResolvedValue({
        projectExists: true,
        candidates: [],
        total: 52,
      }),
    });
    const service = createProjectCollaborationService(store);

    await expect(
      service.listCandidates(actor, "project-1", {
        search: "  Luis  ",
        page: 2,
      }),
    ).resolves.toEqual({
      candidates: [],
      pagination: { page: 2, pageSize: 25, total: 52, totalPages: 3 },
    });
    expect(store.listCandidates).toHaveBeenCalledWith("org-1", "project-1", {
      search: "Luis",
      page: 2,
      pageSize: 25,
    });
  });

  test("uses explicit history pagination for former assignments", async () => {
    const store = createStore({
      listAssignments: vi.fn().mockResolvedValue({
        projectExists: true,
        active: [],
        history: [],
        historyTotal: 26,
      }),
    });
    const service = createProjectCollaborationService(store);

    await expect(
      service.listAssignments(actor, "project-1", {
        historyPage: 2,
        historyPageSize: 10,
      }),
    ).resolves.toMatchObject({
      historyPagination: { page: 2, pageSize: 10, total: 26, totalPages: 3 },
    });
    expect(store.listAssignments).toHaveBeenCalledWith("org-1", "project-1", {
      historyPage: 2,
      historyPageSize: 10,
    });
  });

  test("returns tenant-safe not found when the project is unavailable", async () => {
    const service = createProjectCollaborationService(
      createStore({
        listAssignments: vi.fn().mockResolvedValue({
          projectExists: false,
          active: [],
          history: [],
          historyTotal: 0,
        }),
      }),
    );

    await expect(
      service.listAssignments(actor, "another-project", {}),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  test("maps stale assignment writes to conflict", async () => {
    const service = createProjectCollaborationService(
      createStore({
        changeResponsibility: vi.fn().mockResolvedValue({
          status: "conflict",
        }),
      }),
    );

    await expect(
      service.changeResponsibility(
        actor,
        "project-1",
        "assignment-1",
        "member",
      ),
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });

  test("does not persist or emit activity when responsibility is unchanged", async () => {
    const store = createStore({
      changeResponsibility: vi.fn().mockResolvedValue({
        status: "unchanged",
        assignment,
      }),
    });
    const service = createProjectCollaborationService(store);

    await expect(
      service.changeResponsibility(
        actor,
        "project-1",
        "assignment-1",
        "responsible",
      ),
    ).resolves.toEqual(assignment);
  });

  test.each([
    ["forbidden", "FORBIDDEN"],
    ["last_owner", "LAST_OWNER"],
    ["conflict", "CONFLICT"],
    ["not_found", "NOT_FOUND"],
  ] as const)("maps member removal outcome %s to %s", async (status, code) => {
    const service = createProjectCollaborationService(
      createStore({
        removeOrganizationMember: vi.fn().mockResolvedValue({ status }),
      }),
    );

    await expect(
      service.removeOrganizationMember(actor, "member-2"),
    ).rejects.toMatchObject({ code });
  });
});
