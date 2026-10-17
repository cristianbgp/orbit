import { and, asc, eq, isNull, or, sql } from "drizzle-orm";

import { member } from "../db/auth-schema";
import type { createDatabase } from "../db/client";
import { featureFlag } from "../db/feature-flag-schema";
import type { FeatureFlagStore } from "./feature-flag-types";

type Database = ReturnType<typeof createDatabase>["db"];

export function createDrizzleFeatureFlagStore(db: Database): FeatureFlagStore {
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

    async listCandidates(organizationId) {
      return db
        .select({
          key: featureFlag.key,
          organizationId: featureFlag.organizationId,
          enabled: featureFlag.enabled,
        })
        .from(featureFlag)
        .where(
          or(
            isNull(featureFlag.organizationId),
            eq(featureFlag.organizationId, organizationId),
          ),
        )
        .orderBy(
          sql`${featureFlag.organizationId} NULLS FIRST`,
          asc(featureFlag.key),
        );
    },
  };
}
