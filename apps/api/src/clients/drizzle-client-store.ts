import { and, asc, count, eq } from "drizzle-orm";

import type { createDatabase } from "../db/client";
import { member } from "../db/auth-schema";
import { client } from "../db/client-schema";
import { accentInsensitiveMatchesAny } from "../db/search-text";
import type {
  ClientListFilters,
  ClientPatchValues,
  ClientValues,
} from "./client-types";
import type { ClientStore } from "./client-service";

type Database = ReturnType<typeof createDatabase>["db"];

function clientWhere(organizationId: string, filters: ClientListFilters) {
  const search = filters.search
    ? accentInsensitiveMatchesAny(
        [client.name, client.documentNumber],
        filters.search,
      )
    : undefined;
  const type = filters.type ? eq(client.type, filters.type) : undefined;

  return and(eq(client.organizationId, organizationId), search, type);
}

export function createDrizzleClientStore(db: Database): ClientStore {
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

    async list(organizationId: string, filters: ClientListFilters) {
      const where = clientWhere(organizationId, filters);
      const [clients, totals] = await Promise.all([
        db
          .select()
          .from(client)
          .where(where)
          .orderBy(asc(client.name), asc(client.id))
          .limit(filters.pageSize)
          .offset((filters.page - 1) * filters.pageSize),
        db.select({ value: count() }).from(client).where(where),
      ]);

      return { clients, total: totals[0]?.value ?? 0 };
    },

    async get(organizationId, clientId) {
      const rows = await db
        .select()
        .from(client)
        .where(
          and(
            eq(client.organizationId, organizationId),
            eq(client.id, clientId),
          ),
        )
        .limit(1);

      return rows[0] ?? null;
    },

    async create(
      organizationId: string,
      clientId: string,
      values: ClientValues,
    ) {
      const rows = await db
        .insert(client)
        .values({ id: clientId, organizationId, ...values })
        .returning();

      return rows[0];
    },

    async update(
      organizationId: string,
      clientId: string,
      values: ClientPatchValues,
    ) {
      const rows = await db
        .update(client)
        .set({ ...values, updatedAt: new Date() })
        .where(
          and(
            eq(client.organizationId, organizationId),
            eq(client.id, clientId),
          ),
        )
        .returning();

      return rows[0] ?? null;
    },
  };
}
