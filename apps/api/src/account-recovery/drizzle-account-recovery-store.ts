import { and, desc, eq } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import type { createDatabase } from "../db/client";
import { accountRecoveryActivity } from "../db/account-recovery-schema";
import { member, user } from "../db/auth-schema";
import type {
  AccountRecoveryContext,
  AccountRecoveryStore,
} from "./account-recovery-types";

type Database = ReturnType<typeof createDatabase>["db"];

const actorMembership = alias(member, "recovery_actor_membership");
const actorUser = alias(user, "recovery_actor_user");
const subjectMembership = alias(member, "recovery_subject_membership");
const subjectUser = alias(user, "recovery_subject_user");

function contextSelection() {
  return {
    organizationId: actorMembership.organizationId,
    actorUserId: actorUser.id,
    actorName: actorUser.name,
    actorRole: actorMembership.role,
    subjectUserId: subjectUser.id,
    subjectName: subjectUser.name,
    subjectEmail: subjectUser.email,
  };
}

function toContext(row: {
  organizationId: string;
  actorUserId: string;
  actorName: string;
  actorRole: string;
  subjectUserId: string;
  subjectName: string;
  subjectEmail: string;
}): AccountRecoveryContext {
  return {
    organizationId: row.organizationId,
    actor: {
      userId: row.actorUserId,
      name: row.actorName,
      role: row.actorRole,
    },
    subject: {
      userId: row.subjectUserId,
      name: row.subjectName,
      email: row.subjectEmail,
    },
  };
}

export function createDrizzleAccountRecoveryStore(
  db: Database,
): AccountRecoveryStore {
  return {
    async getTarget(actor, subjectUserId) {
      const rows = await db
        .select(contextSelection())
        .from(actorMembership)
        .innerJoin(actorUser, eq(actorUser.id, actorMembership.userId))
        .innerJoin(
          subjectMembership,
          eq(subjectMembership.organizationId, actorMembership.organizationId),
        )
        .innerJoin(subjectUser, eq(subjectUser.id, subjectMembership.userId))
        .where(
          and(
            eq(actorMembership.userId, actor.userId),
            eq(actorMembership.organizationId, actor.organizationId),
            eq(subjectMembership.userId, subjectUserId),
          ),
        )
        .limit(1);

      return rows[0] ? toContext(rows[0]) : null;
    },

    async findOperationalTarget(email) {
      const rows = await db
        .select({
          organizationId: member.organizationId,
          subjectUserId: user.id,
          subjectName: user.name,
          subjectEmail: user.email,
        })
        .from(user)
        .innerJoin(member, eq(member.userId, user.id))
        .where(eq(user.email, email))
        .limit(1);
      const row = rows[0];
      return row
        ? {
            organizationId: row.organizationId,
            actor: null,
            subject: {
              userId: row.subjectUserId,
              name: row.subjectName,
              email: row.subjectEmail,
            },
          }
        : null;
    },

    async recordGenerated(context) {
      await db.insert(accountRecoveryActivity).values({
        id: crypto.randomUUID(),
        organizationId: context.organizationId,
        actorUserId: context.actor?.userId ?? null,
        actorNameSnapshot: context.actor?.name ?? "Operador de Orbit",
        subjectUserId: context.subject.userId,
        subjectNameSnapshot: context.subject.name,
        subjectEmailSnapshot: context.subject.email,
        type: "link_generated",
      });
    },

    async recordCompleted(subject) {
      const currentMembership = await db
        .select({ organizationId: member.organizationId })
        .from(member)
        .where(eq(member.userId, subject.userId))
        .limit(1);
      const previousActivity = currentMembership[0]
        ? null
        : await db
            .select({ organizationId: accountRecoveryActivity.organizationId })
            .from(accountRecoveryActivity)
            .where(eq(accountRecoveryActivity.subjectUserId, subject.userId))
            .orderBy(desc(accountRecoveryActivity.createdAt))
            .limit(1);
      const organizationId =
        currentMembership[0]?.organizationId ??
        previousActivity?.[0]?.organizationId;
      if (!organizationId) return;

      await db.insert(accountRecoveryActivity).values({
        id: crypto.randomUUID(),
        organizationId,
        actorUserId: subject.userId,
        actorNameSnapshot: subject.name,
        subjectUserId: subject.userId,
        subjectNameSnapshot: subject.name,
        subjectEmailSnapshot: subject.email,
        type: "password_reset",
      });
    },
  };
}
