import { and, desc, eq } from "drizzle-orm";

import { invitation, member } from "../db/auth-schema";
import type { createDatabase } from "../db/client";
import type { TeamInvitationStore } from "./team-invitation-service";
import { isStudioMemberPosition } from "../identity/studio-member-position";

type Database = ReturnType<typeof createDatabase>["db"];

export function createDrizzleTeamInvitationStore(
  db: Database,
): TeamInvitationStore {
  return {
    async getMembershipRole(userId, organizationId) {
      const rows = await db
        .select({ role: member.role })
        .from(member)
        .where(
          and(
            eq(member.userId, userId),
            eq(member.organizationId, organizationId),
          ),
        )
        .limit(1);

      return rows[0]?.role ?? null;
    },

    async listPending(organizationId) {
      const rows = await db
        .select({
          id: invitation.id,
          email: invitation.email,
          role: invitation.role,
          position: invitation.position,
          status: invitation.status,
          createdAt: invitation.createdAt,
          expiresAt: invitation.expiresAt,
        })
        .from(invitation)
        .where(
          and(
            eq(invitation.organizationId, organizationId),
            eq(invitation.status, "pending"),
          ),
        )
        .orderBy(desc(invitation.createdAt), desc(invitation.id));

      return rows.map((row) => ({
        id: row.id,
        email: row.email,
        role: "member" as const,
        position: isStudioMemberPosition(row.position) ? row.position : null,
        status: "pending" as const,
        createdAt: row.createdAt,
        expiresAt: row.expiresAt,
      }));
    },
  };
}
