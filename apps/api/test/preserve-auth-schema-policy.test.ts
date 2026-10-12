import { describe, expect, test } from "vitest";

import { preserveAuthSchemaPolicy } from "../src/auth/preserve-auth-schema-policy";

describe("preserveAuthSchemaPolicy", () => {
  test("adds withTimezone to every generated auth timestamp", () => {
    const generated = `
import { pgTable, text, timestamp, index } from "drizzle-orm/pg-core";

export const session = pgTable("session", {
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export const member = pgTable(
  "member",
  { userId: text("user_id") },
  (table) => [index("member_userId_idx").on(table.userId)],
);
`;

    const preserved = preserveAuthSchemaPolicy(generated);

    expect(preserved).toContain(
      'expiresAt: timestamp("expires_at", { withTimezone: true }).notNull()',
    );
    expect(preserved).toContain(
      'createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()',
    );
    expect(preserved.match(/withTimezone: true/g)).toHaveLength(2);
  });

  test("restores the one-studio unique membership index after generation", () => {
    const generated = `
import { pgTable, text, index } from "drizzle-orm/pg-core";

export const member = pgTable(
  "member",
  { userId: text("user_id") },
  (table) => [
    index("member_userId_idx").on(table.userId),
  ],
);
`;

    expect(preserveAuthSchemaPolicy(generated)).toContain(
      'import { pgTable, text, index, uniqueIndex } from "drizzle-orm/pg-core";',
    );
    expect(preserveAuthSchemaPolicy(generated)).toContain(
      'uniqueIndex("member_userId_unique").on(table.userId)',
    );
  });

  test("preserves the normalized non-null avatar color database policy", () => {
    const generated = `
import { relations } from "drizzle-orm";
import { pgTable, text, index } from "drizzle-orm/pg-core";

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  avatarColor: text("avatar_color").default("#4657d9").notNull(),
});
export const member = pgTable(
  "member",
  { userId: text("user_id") },
  (table) => [index("member_userId_idx").on(table.userId)],
);
`;

    const preserved = preserveAuthSchemaPolicy(generated);

    expect(preserved).toContain(
      'import { relations, sql } from "drizzle-orm";',
    );
    expect(preserved).toContain('check("user_avatar_color_hex_check"');
    expect(preserved).toContain("table.avatarColor");
    expect(preserved).toContain("^#[0-9a-f]{6}$");
  });

  test("is idempotent when the policy is already present", () => {
    const preserved = `
import { pgTable, text, timestamp, index, uniqueIndex } from "drizzle-orm/pg-core";
timestamp("created_at", { withTimezone: true }),
uniqueIndex("member_userId_unique").on(table.userId),
`;

    expect(preserveAuthSchemaPolicy(preserved)).toBe(preserved);
  });
});
