import { and, asc, count, eq, sql } from "drizzle-orm";

import { member, user } from "../db/auth-schema";
import type { createDatabase } from "../db/client";
import { accentInsensitiveMatchesAny } from "../db/search-text";
import type { IdentityStore } from "./identity-service";
import type { StudioMemberRecord } from "./identity-types";
import { isStudioMemberPosition } from "./studio-member-position";

type Database = ReturnType<typeof createDatabase>["db"];

const userSelection = {
  id: user.id,
  alias: user.alias,
  avatarColor: user.avatarColor,
  name: user.name,
  email: user.email,
  image: user.image,
  createdAt: user.createdAt,
};

const memberSelection = {
  memberId: member.id,
  userId: member.userId,
  alias: user.alias,
  avatarColor: user.avatarColor,
  name: user.name,
  email: user.email,
  image: user.image,
  role: member.role,
  position: member.position,
  memberSince: member.createdAt,
};

function normalizeMemberRecord(
  row: Omit<StudioMemberRecord, "position"> & { position: string | null },
): StudioMemberRecord {
  return {
    ...row,
    position: isStudioMemberPosition(row.position) ? row.position : null,
  };
}

const effectiveUserAlias = sql<string>`coalesce(
  ${user.alias},
  public.orbit_generate_user_alias(${user.name})
)`;

function memberWhere(
  organizationId: string,
  filters: { q?: string; position?: string },
) {
  const search = filters.q
    ? accentInsensitiveMatchesAny(
        [user.name, user.email, effectiveUserAlias],
        filters.q,
      )
    : undefined;
  const position = filters.position
    ? eq(member.position, filters.position)
    : undefined;
  return and(eq(member.organizationId, organizationId), search, position);
}

export function createDrizzleIdentityStore(db: Database): IdentityStore {
  return {
    async hasMembership(userId, organizationId) {
      const rows = await db
        .select({ id: member.id })
        .from(member)
        .where(
          and(
            eq(member.userId, userId),
            eq(member.organizationId, organizationId),
          ),
        )
        .limit(1);
      return rows.length > 0;
    },

    async findUser(userId) {
      const rows = await db
        .select(userSelection)
        .from(user)
        .where(eq(user.id, userId))
        .limit(1);
      return rows[0] ?? null;
    },

    async updateProfile(userId, input) {
      const rows = await db
        .update(user)
        .set(input)
        .where(eq(user.id, userId))
        .returning(userSelection);
      return rows[0] ?? null;
    },

    async listMembers(organizationId, { page, pageSize, q, position }) {
      const where = memberWhere(organizationId, { q, position });
      const [members, totals] = await Promise.all([
        db
          .select(memberSelection)
          .from(member)
          .innerJoin(user, eq(member.userId, user.id))
          .where(where)
          .orderBy(asc(user.alias), asc(user.name), asc(user.id))
          .limit(pageSize)
          .offset((page - 1) * pageSize),
        db
          .select({ value: count() })
          .from(member)
          .innerJoin(user, eq(member.userId, user.id))
          .where(where),
      ]);
      return {
        members: members.map(normalizeMemberRecord),
        total: totals[0]?.value ?? 0,
      };
    },

    async findMember(organizationId, userId) {
      const rows = await db
        .select(memberSelection)
        .from(member)
        .innerJoin(user, eq(member.userId, user.id))
        .where(
          and(
            eq(member.organizationId, organizationId),
            eq(member.userId, userId),
          ),
        )
        .limit(1);
      return rows[0] ? normalizeMemberRecord(rows[0]) : null;
    },

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

    async updateMemberPosition(organizationId, memberId, position) {
      const updated = await db
        .update(member)
        .set({ position })
        .where(
          and(
            eq(member.id, memberId),
            eq(member.organizationId, organizationId),
          ),
        )
        .returning({ id: member.id });
      if (!updated[0]) return null;

      const rows = await db
        .select(memberSelection)
        .from(member)
        .innerJoin(user, eq(member.userId, user.id))
        .where(
          and(
            eq(member.id, memberId),
            eq(member.organizationId, organizationId),
          ),
        )
        .limit(1);
      return rows[0] ? normalizeMemberRecord(rows[0]) : null;
    },
  };
}
