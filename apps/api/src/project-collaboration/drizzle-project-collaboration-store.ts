import {
  and,
  asc,
  count,
  desc,
  eq,
  inArray,
  isNotNull,
  isNull,
  sql,
} from "drizzle-orm";

import type { createDatabase } from "../db/client";
import { accentInsensitiveMatchesAny } from "../db/search-text";
import { member, session, user } from "../db/auth-schema";
import { project } from "../db/project-schema";
import {
  projectActivity,
  projectAssignment,
} from "../db/project-collaboration-schema";
import { projectTask, taskAssignment } from "../db/project-task-schema";
import { resolveUserAlias } from "../identity/user-alias";
import type { ProjectCollaborationStore } from "./project-collaboration-service";
import type {
  ActiveCollaborationMember,
  ProjectActivityIdentityRecord,
  ProjectAssignmentRecord,
} from "./project-collaboration-types";

type Database = ReturnType<typeof createDatabase>["db"];
type QueryDatabase = Pick<Database, "select">;

const memberSelection = {
  memberId: member.id,
  userId: member.userId,
  organizationId: member.organizationId,
  role: member.role,
  name: user.name,
  email: user.email,
  alias: user.alias,
  avatarColor: user.avatarColor,
};

const assignmentSnapshotSelection = {
  id: projectAssignment.id,
  organizationId: projectAssignment.organizationId,
  projectId: projectAssignment.projectId,
  userId: projectAssignment.userId,
  userName: projectAssignment.userNameSnapshot,
  userEmail: projectAssignment.userEmailSnapshot,
  responsibility: projectAssignment.responsibility,
  assignedByUserId: projectAssignment.assignedByUserId,
  assignedByName: projectAssignment.assignedByNameSnapshot,
  assignedAt: projectAssignment.assignedAt,
  endedAt: projectAssignment.endedAt,
  endedByUserId: projectAssignment.endedByUserId,
  endedByName: projectAssignment.endedByNameSnapshot,
  endReason: projectAssignment.endReason,
};

const assignmentWithIdentitySelection = {
  ...assignmentSnapshotSelection,
  currentMemberId: member.id,
  currentUserName: user.name,
  userAlias: user.alias,
  userAvatarColor: user.avatarColor,
};

const effectiveUserAlias = sql<string>`coalesce(
  ${user.alias},
  public.orbit_generate_user_alias(${user.name})
)`;

const activitySelection = {
  id: projectActivity.id,
  organizationId: projectActivity.organizationId,
  projectId: projectActivity.projectId,
  type: projectActivity.type,
  actorUserId: projectActivity.actorUserId,
  actorNameSnapshot: projectActivity.actorNameSnapshot,
  subjectUserId: projectActivity.subjectUserId,
  subjectNameSnapshot: projectActivity.subjectNameSnapshot,
  details: projectActivity.details,
  createdAt: projectActivity.createdAt,
};

const activityIdentitySelection = {
  userId: member.userId,
  alias: effectiveUserAlias,
  avatarColor: user.avatarColor,
};

const taskAssignmentCleanupSelection = {
  id: taskAssignment.id,
  projectId: taskAssignment.projectId,
  taskId: taskAssignment.taskId,
  taskTitle: projectTask.title,
};

function activityValues(
  createId: () => string,
  actor: ActiveCollaborationMember,
  projectId: string,
  type: string,
  subject: { userId: string | null; name: string | null },
  details: Record<string, string | null>,
) {
  return {
    id: createId(),
    organizationId: actor.organizationId,
    projectId,
    type,
    actorUserId: actor.userId,
    actorNameSnapshot: actor.name,
    subjectUserId: subject.userId,
    subjectNameSnapshot: subject.name,
    details,
  };
}

function activityIdentity(
  userId: string | null,
  nameSnapshot: string,
  current: { alias: string; avatarColor: string } | undefined,
): ProjectActivityIdentityRecord {
  return {
    userId,
    alias: current?.alias ?? null,
    avatarColor: current?.avatarColor ?? null,
    nameSnapshot,
    activeStudioMember: current !== undefined,
    linkable: userId !== null && current !== undefined,
  };
}

function isActiveAssignmentUniqueViolation(error: unknown) {
  if (typeof error !== "object" || error === null) return false;
  const postgresError = error as {
    code?: string;
    constraint_name?: string;
    constraint?: string;
  };
  return (
    postgresError.code === "23505" &&
    (postgresError.constraint_name ===
      "project_assignment_active_user_unique" ||
      postgresError.constraint === "project_assignment_active_user_unique")
  );
}

function assignmentWithCurrentIdentity(
  row: Omit<
    ProjectAssignmentRecord,
    "userAlias" | "userAvatarColor" | "activeStudioMember"
  > & {
    currentMemberId: string | null;
    currentUserName: string | null;
    userAlias: string | null;
    userAvatarColor: string | null;
  },
) {
  const {
    currentMemberId,
    currentUserName,
    userAlias,
    userAvatarColor,
    ...snapshot
  } = row;
  return {
    ...snapshot,
    userAlias: resolveUserAlias(
      currentMemberId === null ? null : userAlias,
      currentMemberId === null
        ? snapshot.userName
        : (currentUserName ?? snapshot.userName),
    ),
    userAvatarColor: currentMemberId === null ? null : userAvatarColor,
    activeStudioMember: currentMemberId !== null,
  };
}

async function currentAssignmentIdentity(
  source: QueryDatabase,
  organizationId: string,
  userId: string | null,
  fallbackName: string,
) {
  if (userId === null) {
    return {
      userAlias: resolveUserAlias(null, fallbackName),
      userAvatarColor: null,
      activeStudioMember: false,
    };
  }
  const currentMembers = await source
    .select({
      memberId: member.id,
      currentUserName: user.name,
      userAlias: user.alias,
      userAvatarColor: user.avatarColor,
    })
    .from(member)
    .innerJoin(user, eq(member.userId, user.id))
    .where(
      and(eq(member.organizationId, organizationId), eq(member.userId, userId)),
    )
    .limit(1);
  return {
    userAlias: resolveUserAlias(
      currentMembers[0]?.userAlias,
      currentMembers[0]?.currentUserName ?? fallbackName,
    ),
    userAvatarColor: currentMembers[0]?.userAvatarColor ?? null,
    activeStudioMember: currentMembers.length > 0,
  };
}

export function createDrizzleProjectCollaborationStore(
  db: Database,
  createId: () => string = () => crypto.randomUUID(),
): ProjectCollaborationStore {
  return {
    async findActiveMember(userId, organizationId) {
      const rows = await db
        .select(memberSelection)
        .from(member)
        .innerJoin(user, eq(member.userId, user.id))
        .where(
          and(
            eq(member.userId, userId),
            eq(member.organizationId, organizationId),
          ),
        )
        .limit(1);
      return rows[0] ?? null;
    },

    async listAssignments(
      organizationId,
      projectId,
      { historyPage, historyPageSize },
    ) {
      const projects = await db
        .select({ id: project.id })
        .from(project)
        .where(
          and(
            eq(project.organizationId, organizationId),
            eq(project.id, projectId),
          ),
        )
        .limit(1);
      if (projects.length === 0) {
        return {
          projectExists: false,
          active: [],
          history: [],
          historyTotal: 0,
        };
      }

      const scope = and(
        eq(projectAssignment.organizationId, organizationId),
        eq(projectAssignment.projectId, projectId),
      );
      const [active, history, totals] = await Promise.all([
        db
          .select(assignmentWithIdentitySelection)
          .from(projectAssignment)
          .leftJoin(
            member,
            and(
              eq(member.organizationId, projectAssignment.organizationId),
              eq(member.userId, projectAssignment.userId),
            ),
          )
          .leftJoin(user, eq(user.id, member.userId))
          .where(and(scope, isNull(projectAssignment.endedAt)))
          .orderBy(
            asc(projectAssignment.responsibility),
            asc(projectAssignment.userNameSnapshot),
          ),
        db
          .select(assignmentWithIdentitySelection)
          .from(projectAssignment)
          .leftJoin(
            member,
            and(
              eq(member.organizationId, projectAssignment.organizationId),
              eq(member.userId, projectAssignment.userId),
            ),
          )
          .leftJoin(user, eq(user.id, member.userId))
          .where(and(scope, isNotNull(projectAssignment.endedAt)))
          .orderBy(desc(projectAssignment.endedAt))
          .limit(historyPageSize)
          .offset((historyPage - 1) * historyPageSize),
        db
          .select({ value: count() })
          .from(projectAssignment)
          .where(and(scope, isNotNull(projectAssignment.endedAt))),
      ]);
      return {
        projectExists: true,
        active: active.map(assignmentWithCurrentIdentity),
        history: history.map(assignmentWithCurrentIdentity),
        historyTotal: totals[0]?.value ?? 0,
      };
    },

    async listCandidates(
      organizationId,
      projectId,
      { search, page, pageSize },
    ) {
      const projects = await db
        .select({ id: project.id })
        .from(project)
        .where(
          and(
            eq(project.organizationId, organizationId),
            eq(project.id, projectId),
          ),
        )
        .limit(1);
      if (projects.length === 0) {
        return { projectExists: false, candidates: [], total: 0 };
      }

      const searchFilter = search
        ? accentInsensitiveMatchesAny(
            [user.name, user.email, effectiveUserAlias],
            search,
          )
        : undefined;
      const where = and(
        eq(member.organizationId, organizationId),
        searchFilter,
      );
      const [members, totals] = await Promise.all([
        db
          .select(memberSelection)
          .from(member)
          .innerJoin(user, eq(member.userId, user.id))
          .where(where)
          .orderBy(asc(user.name), asc(user.id))
          .limit(pageSize)
          .offset((page - 1) * pageSize),
        db
          .select({ value: count() })
          .from(member)
          .innerJoin(user, eq(member.userId, user.id))
          .where(where),
      ]);
      const userIds = members.map((candidate) => candidate.userId);
      const assigned =
        userIds.length === 0
          ? []
          : await db
              .select({ userId: projectAssignment.userId })
              .from(projectAssignment)
              .where(
                and(
                  eq(projectAssignment.organizationId, organizationId),
                  eq(projectAssignment.projectId, projectId),
                  isNull(projectAssignment.endedAt),
                  inArray(projectAssignment.userId, userIds),
                ),
              );
      const assignedIds = new Set(assigned.map(({ userId }) => userId));
      return {
        projectExists: true,
        candidates: members.map((candidate) => ({
          memberId: candidate.memberId,
          userId: candidate.userId,
          name: candidate.name,
          email: candidate.email,
          userAlias: resolveUserAlias(candidate.alias, candidate.name),
          userAvatarColor: candidate.avatarColor,
          activeStudioMember: true,
          assigned: assignedIds.has(candidate.userId),
        })),
        total: totals[0]?.value ?? 0,
      };
    },

    async addAssignments({ actor, projectId, assignments }) {
      try {
        return await db.transaction(async (transaction) => {
          const requestedIds = assignments.map(({ userId }) => userId);
          const lockUserIds = [
            ...new Set([actor.userId, ...requestedIds]),
          ].sort();
          const lockedMembers = await transaction
            .select(memberSelection)
            .from(member)
            .innerJoin(user, eq(member.userId, user.id))
            .where(
              and(
                eq(member.organizationId, actor.organizationId),
                inArray(member.userId, lockUserIds),
              ),
            )
            .orderBy(asc(member.id))
            .for("update");
          const transactionActor = lockedMembers.find(
            (candidate) =>
              candidate.memberId === actor.memberId &&
              candidate.userId === actor.userId,
          );
          if (!transactionActor) return { status: "forbidden" as const };

          const projects = await transaction
            .select({ id: project.id, archivedAt: project.archivedAt })
            .from(project)
            .where(
              and(
                eq(project.organizationId, actor.organizationId),
                eq(project.id, projectId),
              ),
            )
            .limit(1)
            .for("update");
          if (projects.length === 0) return { status: "not_found" as const };
          if (projects[0]!.archivedAt) {
            return { status: "project_archived" as const };
          }

          const requestedIdSet = new Set(requestedIds);
          const subjects = lockedMembers.filter((candidate) =>
            requestedIdSet.has(candidate.userId),
          );
          if (subjects.length !== requestedIds.length) {
            return { status: "not_found" as const };
          }

          const existing = await transaction
            .select({ userId: projectAssignment.userId })
            .from(projectAssignment)
            .where(
              and(
                eq(projectAssignment.organizationId, actor.organizationId),
                eq(projectAssignment.projectId, projectId),
                isNull(projectAssignment.endedAt),
                inArray(projectAssignment.userId, requestedIds),
              ),
            );
          if (existing.length > 0) return { status: "conflict" as const };

          const subjectById = new Map(
            subjects.map((subject) => [subject.userId, subject]),
          );
          const values = assignments.map((input) => {
            const subject = subjectById.get(input.userId)!;
            return {
              id: createId(),
              organizationId: actor.organizationId,
              projectId,
              userId: subject.userId,
              userNameSnapshot: subject.name,
              userEmailSnapshot: subject.email,
              responsibility: input.responsibility,
              assignedByUserId: transactionActor.userId,
              assignedByNameSnapshot: transactionActor.name,
            };
          });
          const created = await transaction
            .insert(projectAssignment)
            .values(values)
            .returning(assignmentSnapshotSelection);

          const createdWithIdentity = created.map((record) => ({
            ...record,
            userAlias: resolveUserAlias(
              subjectById.get(record.userId ?? "")?.alias,
              subjectById.get(record.userId ?? "")?.name ?? record.userName,
            ),
            userAvatarColor:
              subjectById.get(record.userId ?? "")?.avatarColor ?? null,
            activeStudioMember: subjectById.has(record.userId ?? ""),
          }));

          await transaction.insert(projectActivity).values(
            createdWithIdentity.map((record) =>
              activityValues(
                createId,
                transactionActor,
                projectId,
                "project_assignment.added",
                { userId: record.userId, name: record.userName },
                {
                  assignmentId: record.id,
                  responsibility: record.responsibility,
                },
              ),
            ),
          );
          return {
            status: "created" as const,
            assignments: createdWithIdentity,
          };
        });
      } catch (error) {
        if (isActiveAssignmentUniqueViolation(error)) {
          return { status: "conflict" as const };
        }
        throw error;
      }
    },

    async changeResponsibility({
      actor,
      projectId,
      assignmentId,
      responsibility,
    }) {
      return db.transaction(async (transaction) => {
        const actors = await transaction
          .select(memberSelection)
          .from(member)
          .innerJoin(user, eq(member.userId, user.id))
          .where(
            and(
              eq(member.id, actor.memberId),
              eq(member.userId, actor.userId),
              eq(member.organizationId, actor.organizationId),
            ),
          )
          .limit(1)
          .for("update");
        const transactionActor = actors[0];
        if (!transactionActor) return { status: "forbidden" as const };

        const projects = await transaction
          .select({ id: project.id, archivedAt: project.archivedAt })
          .from(project)
          .where(
            and(
              eq(project.organizationId, actor.organizationId),
              eq(project.id, projectId),
            ),
          )
          .limit(1)
          .for("update");
        if (projects.length === 0) return { status: "not_found" as const };
        if (projects[0]!.archivedAt) {
          return { status: "project_archived" as const };
        }

        const rows = await transaction
          .select(assignmentSnapshotSelection)
          .from(projectAssignment)
          .where(
            and(
              eq(projectAssignment.organizationId, actor.organizationId),
              eq(projectAssignment.projectId, projectId),
              eq(projectAssignment.id, assignmentId),
            ),
          )
          .limit(1)
          .for("update");
        const current = rows[0];
        if (!current) return { status: "not_found" as const };
        if (current.endedAt) return { status: "conflict" as const };
        const currentIdentity = await currentAssignmentIdentity(
          transaction,
          actor.organizationId,
          current.userId,
          current.userName,
        );
        if (current.responsibility === responsibility) {
          return {
            status: "unchanged" as const,
            assignment: { ...current, ...currentIdentity },
          };
        }

        const updated = await transaction
          .update(projectAssignment)
          .set({ responsibility })
          .where(
            and(
              eq(projectAssignment.id, assignmentId),
              isNull(projectAssignment.endedAt),
            ),
          )
          .returning(assignmentSnapshotSelection);
        if (!updated[0]) return { status: "conflict" as const };
        await transaction.insert(projectActivity).values(
          activityValues(
            createId,
            transactionActor,
            projectId,
            "project_assignment.responsibility_changed",
            { userId: current.userId, name: current.userName },
            {
              assignmentId,
              previousResponsibility: current.responsibility,
              newResponsibility: responsibility,
            },
          ),
        );
        return {
          status: "updated" as const,
          assignment: { ...updated[0], ...currentIdentity },
        };
      });
    },

    async endAssignment({ actor, projectId, assignmentId }) {
      return db.transaction(async (transaction) => {
        const actors = await transaction
          .select(memberSelection)
          .from(member)
          .innerJoin(user, eq(member.userId, user.id))
          .where(
            and(
              eq(member.id, actor.memberId),
              eq(member.userId, actor.userId),
              eq(member.organizationId, actor.organizationId),
            ),
          )
          .limit(1)
          .for("update");
        const transactionActor = actors[0];
        if (!transactionActor) return { status: "forbidden" as const };

        const projects = await transaction
          .select({ id: project.id, archivedAt: project.archivedAt })
          .from(project)
          .where(
            and(
              eq(project.organizationId, actor.organizationId),
              eq(project.id, projectId),
            ),
          )
          .limit(1)
          .for("update");
        if (projects.length === 0) return { status: "not_found" as const };
        if (projects[0]!.archivedAt) {
          return { status: "project_archived" as const };
        }

        const currentRows = await transaction
          .select(assignmentSnapshotSelection)
          .from(projectAssignment)
          .where(
            and(
              eq(projectAssignment.organizationId, actor.organizationId),
              eq(projectAssignment.projectId, projectId),
              eq(projectAssignment.id, assignmentId),
            ),
          )
          .limit(1)
          .for("update");
        const current = currentRows[0];
        if (!current) return { status: "not_found" as const };
        if (current.endedAt) return { status: "conflict" as const };
        const currentIdentity = await currentAssignmentIdentity(
          transaction,
          actor.organizationId,
          current.userId,
          current.userName,
        );

        const taskAssignments =
          current.userId === null
            ? []
            : await transaction
                .select(taskAssignmentCleanupSelection)
                .from(taskAssignment)
                .innerJoin(
                  projectTask,
                  eq(taskAssignment.taskId, projectTask.id),
                )
                .where(
                  and(
                    eq(taskAssignment.organizationId, actor.organizationId),
                    eq(taskAssignment.projectId, projectId),
                    eq(taskAssignment.userId, current.userId),
                    isNull(taskAssignment.endedAt),
                  ),
                )
                .for("update");

        const endedAt = new Date();
        const ended = await transaction
          .update(projectAssignment)
          .set({
            endedAt,
            endedByUserId: transactionActor.userId,
            endedByNameSnapshot: transactionActor.name,
            endReason: "project_unassigned",
          })
          .where(
            and(
              eq(projectAssignment.organizationId, actor.organizationId),
              eq(projectAssignment.projectId, projectId),
              eq(projectAssignment.id, assignmentId),
              isNull(projectAssignment.endedAt),
            ),
          )
          .returning(assignmentSnapshotSelection);
        const snapshot = ended[0];
        if (!snapshot) return { status: "conflict" as const };
        const record = {
          ...snapshot,
          ...currentIdentity,
        };
        if (taskAssignments.length > 0) {
          await transaction
            .update(taskAssignment)
            .set({
              endedAt,
              endedByUserId: transactionActor.userId,
              endedByNameSnapshot: transactionActor.name,
              endReason: "project_unassigned",
            })
            .where(
              and(
                eq(taskAssignment.organizationId, actor.organizationId),
                eq(taskAssignment.projectId, projectId),
                inArray(
                  taskAssignment.id,
                  taskAssignments.map(({ id }) => id),
                ),
                isNull(taskAssignment.endedAt),
              ),
            );
        }
        await transaction.insert(projectActivity).values([
          activityValues(
            createId,
            transactionActor,
            projectId,
            "project_assignment.removed",
            { userId: record.userId, name: record.userName },
            {
              assignmentId,
              previousResponsibility: record.responsibility,
            },
          ),
          ...taskAssignments.map((taskResponsibility) =>
            activityValues(
              createId,
              transactionActor,
              projectId,
              "task_assignment.removed",
              { userId: record.userId, name: record.userName },
              {
                taskId: taskResponsibility.taskId,
                taskTitle: taskResponsibility.taskTitle,
                endReason: "project_unassigned",
              },
            ),
          ),
        ]);
        return { status: "ended" as const, assignment: record };
      });
    },

    async listActivities(organizationId, projectId, { page, pageSize }) {
      const projects = await db
        .select({ id: project.id })
        .from(project)
        .where(
          and(
            eq(project.organizationId, organizationId),
            eq(project.id, projectId),
          ),
        )
        .limit(1);
      if (projects.length === 0) {
        return { projectExists: false, activities: [], total: 0 };
      }
      const scope = and(
        eq(projectActivity.organizationId, organizationId),
        eq(projectActivity.projectId, projectId),
      );
      const [activities, totals] = await Promise.all([
        db
          .select(activitySelection)
          .from(projectActivity)
          .where(scope)
          .orderBy(desc(projectActivity.createdAt), desc(projectActivity.id))
          .limit(pageSize)
          .offset((page - 1) * pageSize),
        db.select({ value: count() }).from(projectActivity).where(scope),
      ]);
      const identityUserIds = [
        ...new Set(
          activities.flatMap(({ actorUserId, subjectUserId }) =>
            [actorUserId, subjectUserId].filter(
              (userId): userId is string => userId !== null,
            ),
          ),
        ),
      ];
      const currentIdentities =
        identityUserIds.length === 0
          ? []
          : await db
              .select(activityIdentitySelection)
              .from(member)
              .innerJoin(user, eq(member.userId, user.id))
              .where(
                and(
                  eq(member.organizationId, organizationId),
                  inArray(member.userId, identityUserIds),
                ),
              );
      const currentIdentityByUserId = new Map(
        currentIdentities.map((identity) => [identity.userId, identity]),
      );
      return {
        projectExists: true,
        activities: activities.map((activity) => ({
          id: activity.id,
          organizationId: activity.organizationId,
          projectId: activity.projectId,
          type: activity.type,
          actor: activityIdentity(
            activity.actorUserId,
            activity.actorNameSnapshot,
            activity.actorUserId === null
              ? undefined
              : currentIdentityByUserId.get(activity.actorUserId),
          ),
          subject:
            activity.subjectNameSnapshot === null
              ? null
              : activityIdentity(
                  activity.subjectUserId,
                  activity.subjectNameSnapshot,
                  activity.subjectUserId === null
                    ? undefined
                    : currentIdentityByUserId.get(activity.subjectUserId),
                ),
          details: activity.details,
          createdAt: activity.createdAt,
        })),
        total: totals[0]?.value ?? 0,
      };
    },

    async removeOrganizationMember({ actor, memberId }) {
      return db.transaction(async (transaction) => {
        const lockMemberIds = [actor.memberId, memberId].sort();
        const lockedMembers = await transaction
          .select(memberSelection)
          .from(member)
          .innerJoin(user, eq(member.userId, user.id))
          .where(
            and(
              eq(member.organizationId, actor.organizationId),
              inArray(member.id, lockMemberIds),
            ),
          )
          .orderBy(asc(member.id))
          .for("update");
        const transactionActor = lockedMembers.find(
          (candidate) =>
            candidate.memberId === actor.memberId &&
            candidate.userId === actor.userId,
        );
        if (transactionActor?.role !== "owner") {
          return { status: "forbidden" as const };
        }

        const target = lockedMembers.find(
          (candidate) => candidate.memberId === memberId,
        );
        if (!target) return { status: "not_found" as const };
        if (target.userId === actor.userId) {
          return { status: "forbidden" as const };
        }

        const ownerTotals = await transaction
          .select({ value: count() })
          .from(member)
          .where(
            and(
              eq(member.organizationId, actor.organizationId),
              eq(member.role, "owner"),
            ),
          );
        if (target.role === "owner" && (ownerTotals[0]?.value ?? 0) <= 1) {
          return { status: "last_owner" as const };
        }

        const assignments = await transaction
          .select({
            id: projectAssignment.id,
            projectId: projectAssignment.projectId,
          })
          .from(projectAssignment)
          .where(
            and(
              eq(projectAssignment.organizationId, actor.organizationId),
              eq(projectAssignment.userId, target.userId),
              isNull(projectAssignment.endedAt),
            ),
          )
          .for("update");

        const taskAssignments = await transaction
          .select(taskAssignmentCleanupSelection)
          .from(taskAssignment)
          .innerJoin(projectTask, eq(taskAssignment.taskId, projectTask.id))
          .where(
            and(
              eq(taskAssignment.organizationId, actor.organizationId),
              eq(taskAssignment.userId, target.userId),
              isNull(taskAssignment.endedAt),
            ),
          )
          .for("update");

        const endedAt = new Date();

        if (assignments.length > 0) {
          await transaction
            .update(projectAssignment)
            .set({
              endedAt,
              endedByUserId: transactionActor.userId,
              endedByNameSnapshot: transactionActor.name,
              endReason: "organization_removed",
            })
            .where(
              and(
                eq(projectAssignment.organizationId, actor.organizationId),
                eq(projectAssignment.userId, target.userId),
                isNull(projectAssignment.endedAt),
              ),
            );
        }

        if (taskAssignments.length > 0) {
          await transaction
            .update(taskAssignment)
            .set({
              endedAt,
              endedByUserId: transactionActor.userId,
              endedByNameSnapshot: transactionActor.name,
              endReason: "organization_removed",
            })
            .where(
              and(
                eq(taskAssignment.organizationId, actor.organizationId),
                inArray(
                  taskAssignment.id,
                  taskAssignments.map(({ id }) => id),
                ),
                isNull(taskAssignment.endedAt),
              ),
            );
        }

        const projectIds = [
          ...new Set(assignments.map(({ projectId }) => projectId)),
        ];
        const activities = [
          ...projectIds.map((affectedProjectId) =>
            activityValues(
              createId,
              transactionActor,
              affectedProjectId,
              "organization_member.removed",
              { userId: target.userId, name: target.name },
              { memberId: target.memberId },
            ),
          ),
          ...taskAssignments.map((taskResponsibility) =>
            activityValues(
              createId,
              transactionActor,
              taskResponsibility.projectId,
              "task_assignment.removed",
              { userId: target.userId, name: target.name },
              {
                taskId: taskResponsibility.taskId,
                taskTitle: taskResponsibility.taskTitle,
                endReason: "organization_removed",
              },
            ),
          ),
        ];
        if (activities.length > 0) {
          await transaction.insert(projectActivity).values(activities);
        }

        await transaction
          .update(session)
          .set({ activeOrganizationId: null })
          .where(
            and(
              eq(session.userId, target.userId),
              eq(session.activeOrganizationId, actor.organizationId),
            ),
          );
        await transaction.delete(member).where(eq(member.id, target.memberId));

        return {
          status: "removed" as const,
          member: {
            id: target.memberId,
            userId: target.userId,
            name: target.name,
          },
        };
      });
    },
  };
}
