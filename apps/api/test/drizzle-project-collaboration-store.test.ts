import { describe, expect, test, vi } from "vitest";
import type { SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";

import { projectActivity } from "../src/db/project-collaboration-schema";
import { taskAssignment } from "../src/db/project-task-schema";
import { createDrizzleProjectCollaborationStore } from "../src/project-collaboration/drizzle-project-collaboration-store";

function queryResult<T>(
  value: T,
  onFor?: () => void,
  onOrderBy?: () => void,
  onWhere?: (condition: SQL) => void,
) {
  const query = {
    from: () => query,
    innerJoin: () => query,
    leftJoin: () => query,
    where: (condition: SQL) => {
      onWhere?.(condition);
      return query;
    },
    orderBy: () => {
      onOrderBy?.();
      return query;
    },
    limit: () => query,
    offset: () => query,
    for: () => {
      onFor?.();
      return query;
    },
    then: (resolve: (result: T) => unknown) =>
      Promise.resolve(value).then(resolve),
  };
  return query;
}

const actor = {
  memberId: "member-1",
  userId: "user-1",
  organizationId: "org-1",
  role: "owner",
  name: "Ana Torres",
  email: "ana@orbit.pe",
  alias: "AT",
};

const assignmentRecord = {
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

describe("Drizzle project collaboration store", () => {
  test.each([
    "addAssignments",
    "changeResponsibility",
    "endAssignment",
  ] as const)(
    "rejects %s before changing an archived project",
    async (operation) => {
      const subject = {
        memberId: "member-2",
        userId: "user-2",
        organizationId: "org-1",
        role: "member",
        name: "Luis Ramos",
        email: "luis@orbit.pe",
        alias: "LR",
      };
      const selectResults = [
        operation === "addAssignments" ? [actor, subject] : [actor],
        [
          {
            id: "project-1",
            archivedAt: new Date("2026-08-10T12:00:00.000Z"),
          },
        ],
      ];
      const transaction = {
        select: vi.fn(() => queryResult(selectResults.shift() ?? [])),
        insert: vi.fn(),
        update: vi.fn(),
      };
      const store = createDrizzleProjectCollaborationStore({
        transaction: vi.fn(async (callback) => callback(transaction)),
      } as never);

      const result =
        operation === "addAssignments"
          ? await store.addAssignments({
              actor,
              projectId: "project-1",
              assignments: [{ userId: "user-2", responsibility: "member" }],
            })
          : operation === "changeResponsibility"
            ? await store.changeResponsibility({
                actor,
                projectId: "project-1",
                assignmentId: "assignment-1",
                responsibility: "member",
              })
            : await store.endAssignment({
                actor,
                projectId: "project-1",
                assignmentId: "assignment-1",
              });

      expect(result).toEqual({ status: "project_archived" });
      expect(transaction.insert).not.toHaveBeenCalled();
      expect(transaction.update).not.toHaveBeenCalled();
    },
  );

  test("resolves one activity page against current studio identities", async () => {
    const storedActivities = [
      {
        id: "activity-active",
        organizationId: "org-1",
        projectId: "project-1",
        type: "project_assignment.added",
        actorUserId: "actor-1",
        actorNameSnapshot: "Ana Torres",
        subjectUserId: "subject-1",
        subjectNameSnapshot: "Maria Vega",
        details: { assignmentId: "assignment-1" },
        createdAt: new Date("2026-08-06T20:00:00.000Z"),
      },
      {
        id: "activity-removed",
        organizationId: "org-1",
        projectId: "project-1",
        type: "project_assignment.removed",
        actorUserId: "actor-1",
        actorNameSnapshot: "Ana Torres",
        subjectUserId: "former-1",
        subjectNameSnapshot: "Luis Ramos",
        details: { assignmentId: "assignment-former" },
        createdAt: new Date("2026-08-06T19:00:00.000Z"),
      },
      {
        id: "activity-deleted-actor",
        organizationId: "org-1",
        projectId: "project-1",
        type: "project_assignment.removed",
        actorUserId: null,
        actorNameSnapshot: "Deleted User",
        subjectUserId: null,
        subjectNameSnapshot: null,
        details: {},
        createdAt: new Date("2026-08-06T18:00:00.000Z"),
      },
    ];
    const identityWhereSql: string[] = [];
    const db = {
      select: vi
        .fn()
        .mockImplementationOnce(() => queryResult([{ id: "project-1" }]))
        .mockImplementationOnce(() => queryResult(storedActivities))
        .mockImplementationOnce(() => queryResult([{ value: 3 }]))
        .mockImplementationOnce(() =>
          queryResult(
            [
              { userId: "actor-1", alias: "AT", avatarColor: "#11182b" },
              { userId: "subject-1", alias: "MV", avatarColor: "#4657d9" },
            ],
            undefined,
            undefined,
            (condition) => {
              identityWhereSql.push(new PgDialect().sqlToQuery(condition).sql);
            },
          ),
        ),
    };
    const store = createDrizzleProjectCollaborationStore(db as never);

    const result = await store.listActivities("org-1", "project-1", {
      page: 1,
      pageSize: 25,
    });

    expect(result.activities[0]?.actor).toEqual({
      userId: "actor-1",
      alias: "AT",
      avatarColor: "#11182b",
      nameSnapshot: "Ana Torres",
      activeStudioMember: true,
      linkable: true,
    });
    expect(result.activities[0]?.subject).toEqual({
      userId: "subject-1",
      alias: "MV",
      avatarColor: "#4657d9",
      nameSnapshot: "Maria Vega",
      activeStudioMember: true,
      linkable: true,
    });
    expect(result.activities[1]?.subject).toEqual({
      userId: "former-1",
      alias: null,
      avatarColor: null,
      nameSnapshot: "Luis Ramos",
      activeStudioMember: false,
      linkable: false,
    });
    expect(result.activities[2]?.actor).toEqual({
      userId: null,
      alias: null,
      avatarColor: null,
      nameSnapshot: "Deleted User",
      activeStudioMember: false,
      linkable: false,
    });
    expect(result.activities[2]?.subject).toBeNull();
    expect(storedActivities[0]?.actorNameSnapshot).toBe("Ana Torres");
    expect(db.select).toHaveBeenCalledTimes(4);
    expect(identityWhereSql).toHaveLength(1);
    expect(identityWhereSql[0]).toContain('"member"."organization_id" = $1');
    expect(identityWhereSql[0]).toContain('"member"."user_id" in');
  });

  test("combines assignment snapshots with current studio identities", async () => {
    const formerMember = {
      ...assignmentRecord,
      id: "assignment-former",
      userId: "user-former",
      userName: "Former Member",
      userEmail: "former@orbit.pe",
      endedAt: new Date("2026-08-05T20:00:00.000Z"),
      currentMemberId: null,
      userAlias: null,
    };
    const endedActiveMember = {
      ...assignmentRecord,
      id: "assignment-ended-active",
      userName: "Cristian Granda Pastora",
      userEmail: "cristian@orbit.pe",
      endedAt: new Date("2026-08-04T20:00:00.000Z"),
      currentMemberId: "member-2",
      currentUserName: "Renamed Person",
      userAlias: null,
    };
    const db = {
      select: vi
        .fn()
        .mockImplementationOnce(() => queryResult([{ id: "project-1" }]))
        .mockImplementationOnce(() =>
          queryResult([
            {
              ...assignmentRecord,
              userName: "Cristian Granda Pastora",
              userEmail: "cristian@orbit.pe",
              currentMemberId: "member-2",
              currentUserName: "Renamed Person",
              userAlias: null,
            },
          ]),
        )
        .mockImplementationOnce(() =>
          queryResult([formerMember, endedActiveMember]),
        )
        .mockImplementationOnce(() => queryResult([{ value: 2 }])),
    };
    const store = createDrizzleProjectCollaborationStore(db as never);

    const result = await store.listAssignments("org-1", "project-1", {
      historyPage: 1,
      historyPageSize: 25,
    });

    expect(result.active[0]).toMatchObject({
      userAlias: "RP",
      activeStudioMember: true,
      userName: "Cristian Granda Pastora",
    });
    expect(result.history[0]).toMatchObject({
      userAlias: "FM",
      activeStudioMember: false,
      userName: "Former Member",
    });
    expect(result.history[1]).toMatchObject({
      userAlias: "RP",
      activeStudioMember: true,
      endedAt: expect.any(Date),
    });
  });

  test("returns live aliases for assignment candidates", async () => {
    const candidateWhereSql: string[] = [];
    const captureCandidateWhere = (condition: SQL) => {
      candidateWhereSql.push(new PgDialect().sqlToQuery(condition).sql);
    };
    const db = {
      select: vi
        .fn()
        .mockImplementationOnce(() => queryResult([{ id: "project-1" }]))
        .mockImplementationOnce(() =>
          queryResult(
            [
              {
                ...actor,
                alias: null,
                name: "Cristian Granda Pastora",
                email: "cristian@orbit.pe",
              },
            ],
            undefined,
            undefined,
            captureCandidateWhere,
          ),
        )
        .mockImplementationOnce(() =>
          queryResult(
            [{ value: 1 }],
            undefined,
            undefined,
            captureCandidateWhere,
          ),
        )
        .mockImplementationOnce(() => queryResult([])),
    };
    const store = createDrizzleProjectCollaborationStore(db as never);

    const result = await store.listCandidates("org-1", "project-1", {
      search: "CGP",
      page: 1,
      pageSize: 25,
    });

    expect(result.candidates[0]).toMatchObject({
      userAlias: "CGP",
      activeStudioMember: true,
      name: "Cristian Granda Pastora",
    });
    expect(candidateWhereSql).toHaveLength(2);
    expect(candidateWhereSql).toSatisfy((queries: string[]) =>
      queries.every(
        (query) =>
          query.includes("public.orbit_generate_user_alias") &&
          query.includes("coalesce") &&
          query.includes("public.unaccent") &&
          query.includes(" like "),
      ),
    );
  });

  test("rolls assignment and activity writes into the same transaction", async () => {
    const selectResults = [
      [
        actor,
        {
          memberId: "member-2",
          userId: "user-2",
          organizationId: "org-1",
          role: "member",
          name: "Luis Ramos",
          email: "luis@orbit.pe",
          alias: "LR",
        },
      ],
      [{ id: "project-1", archivedAt: null }],
      [],
    ];
    const outsideInsert = vi.fn();
    const transactionInsert = vi.fn((table) => ({
      values: vi.fn((values) => {
        if (table === projectActivity) {
          return Promise.reject(new Error("activity failed"));
        }
        return {
          returning: vi.fn().mockResolvedValue(values),
        };
      }),
    }));
    const transaction = {
      select: vi.fn(() => queryResult(selectResults.shift() ?? [])),
      insert: transactionInsert,
    };
    const db = {
      insert: outsideInsert,
      transaction: vi.fn(async (callback) => callback(transaction)),
    };
    const store = createDrizzleProjectCollaborationStore(
      db as never,
      () => "generated-id",
    );

    await expect(
      store.addAssignments({
        actor,
        projectId: "project-1",
        assignments: [{ userId: "user-2", responsibility: "responsible" }],
      }),
    ).rejects.toThrow("activity failed");

    expect(db.transaction).toHaveBeenCalledOnce();
    expect(transactionInsert).toHaveBeenCalledTimes(2);
    expect(outsideInsert).not.toHaveBeenCalled();
  });

  test("revalidates and locks the actor and requested members before assignment", async () => {
    const locked: string[] = [];
    const ordered: string[] = [];
    const selectResults = [
      {
        rows: [
          actor,
          {
            memberId: "member-2",
            userId: "user-2",
            organizationId: "org-1",
            role: "member",
            name: "Luis Ramos",
            email: "luis@orbit.pe",
            alias: "LR",
          },
        ],
        label: "members",
      },
      { rows: [{ id: "project-1", archivedAt: null }] },
      { rows: [] },
    ];
    const transaction = {
      select: vi.fn(() => {
        const result = selectResults.shift() ?? { rows: [] };
        return queryResult(
          result.rows,
          () => {
            if (result.label) locked.push(result.label);
          },
          () => {
            if (result.label) ordered.push(result.label);
          },
        );
      }),
      insert: vi.fn((table) => ({
        values: vi.fn((values) =>
          table === projectActivity
            ? Promise.resolve([])
            : { returning: vi.fn().mockResolvedValue(values) },
        ),
      })),
    };
    const store = createDrizzleProjectCollaborationStore(
      {
        transaction: vi.fn(async (callback) => callback(transaction)),
      } as never,
      () => "generated-id",
    );

    await store.addAssignments({
      actor,
      projectId: "project-1",
      assignments: [{ userId: "user-2", responsibility: "member" }],
    });

    expect(locked).toEqual(["members"]);
    expect(ordered).toEqual(["members"]);
  });

  test("rejects an assignment write when the actor membership ended in flight", async () => {
    const selectResults: unknown[][] = [[]];
    const transaction = {
      select: vi.fn(() => queryResult(selectResults.shift() ?? [])),
      insert: vi.fn(),
    };
    const store = createDrizzleProjectCollaborationStore({
      transaction: vi.fn(async (callback) => callback(transaction)),
    } as never);

    await expect(
      store.addAssignments({
        actor,
        projectId: "project-1",
        assignments: [{ userId: "user-2", responsibility: "member" }],
      }),
    ).resolves.toEqual({ status: "forbidden" });
    expect(transaction.insert).not.toHaveBeenCalled();
  });

  test("maps the active assignment unique constraint to conflict", async () => {
    const store = createDrizzleProjectCollaborationStore({
      transaction: vi.fn().mockRejectedValue({
        code: "23505",
        constraint_name: "project_assignment_active_user_unique",
      }),
    } as never);

    await expect(
      store.addAssignments({
        actor,
        projectId: "project-1",
        assignments: [{ userId: "user-2", responsibility: "member" }],
      }),
    ).resolves.toEqual({ status: "conflict" });
  });

  test("distinguishes missing assignments from ended assignment conflicts", async () => {
    const missingTransaction = {
      select: vi
        .fn()
        .mockImplementationOnce(() => queryResult([actor]))
        .mockImplementationOnce(() => queryResult([{ id: "project-1" }]))
        .mockImplementationOnce(() => queryResult([])),
    };
    const missingStore = createDrizzleProjectCollaborationStore({
      transaction: vi.fn(async (callback) => callback(missingTransaction)),
    } as never);

    await expect(
      missingStore.changeResponsibility({
        actor,
        projectId: "project-1",
        assignmentId: "missing",
        responsibility: "member",
      }),
    ).resolves.toEqual({ status: "not_found" });

    const endedTransaction = {
      select: vi
        .fn()
        .mockImplementationOnce(() => queryResult([actor]))
        .mockImplementationOnce(() => queryResult([{ id: "project-1" }]))
        .mockImplementationOnce(() =>
          queryResult([{ ...assignmentRecord, endedAt: new Date() }]),
        ),
    };
    const endedStore = createDrizzleProjectCollaborationStore({
      transaction: vi.fn(async (callback) => callback(endedTransaction)),
    } as never);

    await expect(
      endedStore.endAssignment({
        actor,
        projectId: "project-1",
        assignmentId: "assignment-1",
      }),
    ).resolves.toEqual({ status: "conflict" });
  });

  test("removes a studio member only after assignments, activity, and sessions are updated", async () => {
    const operations: string[] = [];
    const selectResults = [
      [
        actor,
        {
          memberId: "member-2",
          userId: "user-2",
          organizationId: "org-1",
          role: "member",
          name: "Luis Ramos",
          email: "luis@orbit.pe",
          alias: "LR",
        },
      ],
      [{ value: 1 }],
      [{ id: "assignment-1", projectId: "project-1" }],
      [
        {
          id: "task-assignment-1",
          projectId: "project-1",
          taskId: "task-1",
          taskTitle: "Revisar antecedentes",
        },
      ],
    ];
    let updateNumber = 0;
    const updates: Record<string, Record<string, unknown>> = {};
    const activityRecords: Array<Record<string, unknown>> = [];
    const transaction = {
      select: vi.fn(() => queryResult(selectResults.shift() ?? [])),
      update: vi.fn(() => {
        updateNumber += 1;
        const label =
          updateNumber === 1
            ? "assignments"
            : updateNumber === 2
              ? "task-assignments"
              : "sessions";
        const query = {
          set: (values: Record<string, unknown>) => {
            updates[label] = values;
            return query;
          },
          where: () => {
            operations.push(label);
            return Promise.resolve([]);
          },
        };
        return query;
      }),
      insert: vi.fn(() => ({
        values: (
          values: Record<string, unknown> | Array<Record<string, unknown>>,
        ) => {
          activityRecords.push(...(Array.isArray(values) ? values : [values]));
          operations.push("activity");
          return Promise.resolve([]);
        },
      })),
      delete: vi.fn(() => ({
        where: () => {
          operations.push("membership");
          return Promise.resolve([]);
        },
      })),
    };
    const db = {
      transaction: vi.fn(async (callback) => callback(transaction)),
    };
    const store = createDrizzleProjectCollaborationStore(
      db as never,
      () => "generated-id",
    );

    await expect(
      store.removeOrganizationMember({ actor, memberId: "member-2" }),
    ).resolves.toMatchObject({ status: "removed" });
    expect(operations).toEqual([
      "assignments",
      "task-assignments",
      "activity",
      "sessions",
      "membership",
    ]);
    expect(db.transaction).toHaveBeenCalledOnce();
    expect(updates.assignments).toMatchObject({
      endedAt: expect.any(Date),
      endedByUserId: "user-1",
      endedByNameSnapshot: "Ana Torres",
      endReason: "organization_removed",
    });
    expect(updates.assignments).not.toHaveProperty("responsibility");
    expect(updates["task-assignments"]).toMatchObject({
      endedAt: expect.any(Date),
      endedByUserId: "user-1",
      endedByNameSnapshot: "Ana Torres",
      endReason: "organization_removed",
    });
    expect(updates.sessions).toEqual({ activeOrganizationId: null });
    expect(activityRecords).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "organization_member.removed",
          actorNameSnapshot: "Ana Torres",
          subjectNameSnapshot: "Luis Ramos",
          projectId: "project-1",
        }),
        expect.objectContaining({
          type: "task_assignment.removed",
          actorNameSnapshot: "Ana Torres",
          subjectNameSnapshot: "Luis Ramos",
          projectId: "project-1",
          details: expect.objectContaining({
            taskId: "task-1",
            taskTitle: "Revisar antecedentes",
            endReason: "organization_removed",
          }),
        }),
      ]),
    );
  });

  test("ends task responsibilities when someone leaves a project", async () => {
    const selectResults = [
      [actor],
      [{ id: "project-1" }],
      [assignmentRecord],
      [
        {
          memberId: "member-2",
          currentUserName: "Renamed Member",
          userAlias: null,
        },
      ],
      [
        {
          id: "task-assignment-1",
          projectId: "project-1",
          taskId: "task-1",
          taskTitle: "Revisar antecedentes",
        },
      ],
    ];
    const taskUpdates: Record<string, unknown>[] = [];
    const activityValues: Array<Record<string, unknown>> = [];
    const transaction = {
      select: vi.fn(() => queryResult(selectResults.shift() ?? [])),
      update: vi.fn((table) => {
        const query = {
          set: (values: Record<string, unknown>) => {
            if (table === taskAssignment) taskUpdates.push(values);
            return query;
          },
          where: () => ({
            returning: vi
              .fn()
              .mockResolvedValue(
                table === taskAssignment
                  ? []
                  : [{ ...assignmentRecord, endedAt: new Date() }],
              ),
          }),
        };
        return query;
      }),
      insert: vi.fn(() => ({
        values: (
          values: Record<string, unknown> | Array<Record<string, unknown>>,
        ) => {
          activityValues.push(...(Array.isArray(values) ? values : [values]));
          return Promise.resolve([]);
        },
      })),
    };
    const store = createDrizzleProjectCollaborationStore({
      transaction: vi.fn(async (callback) => callback(transaction)),
    } as never);

    await expect(
      store.endAssignment({
        actor,
        projectId: "project-1",
        assignmentId: "assignment-1",
      }),
    ).resolves.toMatchObject({
      status: "ended",
      assignment: { userAlias: "RM", activeStudioMember: true },
    });
    expect(taskUpdates).toContainEqual(
      expect.objectContaining({ endReason: "project_unassigned" }),
    );
    expect(activityValues).toContainEqual(
      expect.objectContaining({
        type: "task_assignment.removed",
        details: expect.objectContaining({
          taskId: "task-1",
          taskTitle: "Revisar antecedentes",
          endReason: "project_unassigned",
        }),
      }),
    );
  });
});
