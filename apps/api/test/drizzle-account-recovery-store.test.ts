import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import type { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { afterEach, beforeEach, describe, expect, test } from "vitest";

import * as schema from "../src/db/schema";
import { member, organization, user } from "../src/db/schema";
import { createDrizzleAccountRecoveryStore } from "../src/account-recovery/drizzle-account-recovery-store";
import { createTestPGlite } from "./support/create-test-pglite";

describe("Drizzle account recovery store", () => {
  let pg: PGlite;
  let db: ReturnType<typeof drizzle<typeof schema>>;
  const timestamp = new Date("2026-08-18T10:00:00.000Z");

  beforeEach(async () => {
    pg = createTestPGlite();
    db = drizzle(pg, { schema });
    const folder = fileURLToPath(new URL("../drizzle", import.meta.url));
    for (const migration of (await readdir(folder))
      .filter((name) => /^\d{4}_.+\.sql$/.test(name))
      .sort()) {
      await pg.exec(await readFile(`${folder}/${migration}`, "utf8"));
    }

    await db.insert(organization).values([
      {
        id: "org-1",
        name: "Orbit Uno",
        slug: "orbit-uno",
        createdAt: timestamp,
      },
      {
        id: "org-2",
        name: "Orbit Dos",
        slug: "orbit-dos",
        createdAt: timestamp,
      },
    ]);
    await db.insert(user).values([
      {
        id: "owner-1",
        name: "Olivia Owner",
        email: "owner@uno.test",
        emailVerified: true,
        alias: "OO",
        createdAt: timestamp,
        updatedAt: timestamp,
      },
      {
        id: "member-1",
        name: "Ana Miembro",
        email: "ana@uno.test",
        emailVerified: true,
        alias: "AM",
        createdAt: timestamp,
        updatedAt: timestamp,
      },
      {
        id: "member-2",
        name: "Bea Externa",
        email: "bea@dos.test",
        emailVerified: true,
        alias: "BE",
        createdAt: timestamp,
        updatedAt: timestamp,
      },
    ]);
    await db.insert(member).values([
      {
        id: "membership-owner",
        organizationId: "org-1",
        userId: "owner-1",
        role: "owner",
        createdAt: timestamp,
      },
      {
        id: "membership-member-1",
        organizationId: "org-1",
        userId: "member-1",
        role: "member",
        createdAt: timestamp,
      },
      {
        id: "membership-member-2",
        organizationId: "org-2",
        userId: "member-2",
        role: "member",
        createdAt: timestamp,
      },
    ]);
  });

  afterEach(async () => {
    await pg.close();
  });

  test("resolves actor and target only within one organization", async () => {
    const store = createDrizzleAccountRecoveryStore(db as never);

    await expect(
      store.getTarget(
        { userId: "owner-1", organizationId: "org-1" },
        "member-1",
      ),
    ).resolves.toEqual({
      organizationId: "org-1",
      actor: {
        userId: "owner-1",
        name: "Olivia Owner",
        role: "owner",
      },
      subject: {
        userId: "member-1",
        name: "Ana Miembro",
        email: "ana@uno.test",
      },
    });
    await expect(
      store.getTarget(
        { userId: "owner-1", organizationId: "org-1" },
        "member-2",
      ),
    ).resolves.toBeNull();
  });

  test("finds one active operational target by exact normalized email", async () => {
    const store = createDrizzleAccountRecoveryStore(db as never);

    await expect(store.findOperationalTarget("ana@uno.test")).resolves.toEqual({
      organizationId: "org-1",
      actor: null,
      subject: {
        userId: "member-1",
        name: "Ana Miembro",
        email: "ana@uno.test",
      },
    });
    await expect(
      store.findOperationalTarget("ANA@UNO.TEST"),
    ).resolves.toBeNull();
  });

  test("records generated and completed activity without recovery secrets", async () => {
    const store = createDrizzleAccountRecoveryStore(db as never);
    const context = await store.getTarget(
      { userId: "owner-1", organizationId: "org-1" },
      "member-1",
    );
    expect(context).not.toBeNull();

    await store.recordGenerated(context!);
    await store.recordCompleted({
      userId: "member-1",
      name: "Ana Miembro",
      email: "ana@uno.test",
    });

    const rows = await pg.query<{
      organization_id: string;
      actor_user_id: string | null;
      actor_name_snapshot: string;
      subject_user_id: string | null;
      subject_name_snapshot: string;
      subject_email_snapshot: string;
      type: string;
      created_at: Date;
    }>(`
      SELECT organization_id, actor_user_id, actor_name_snapshot,
             subject_user_id, subject_name_snapshot, subject_email_snapshot,
             type, created_at
      FROM account_recovery_activity
      ORDER BY created_at, type;
    `);

    expect(rows.rows).toEqual([
      {
        organization_id: "org-1",
        actor_user_id: "owner-1",
        actor_name_snapshot: "Olivia Owner",
        subject_user_id: "member-1",
        subject_name_snapshot: "Ana Miembro",
        subject_email_snapshot: "ana@uno.test",
        type: "link_generated",
        created_at: expect.any(Date),
      },
      {
        organization_id: "org-1",
        actor_user_id: "member-1",
        actor_name_snapshot: "Ana Miembro",
        subject_user_id: "member-1",
        subject_name_snapshot: "Ana Miembro",
        subject_email_snapshot: "ana@uno.test",
        type: "password_reset",
        created_at: expect.any(Date),
      },
    ]);

    const columns = await pg.query<{ column_name: string }>(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'account_recovery_activity';
    `);
    expect(
      columns.rows.some(({ column_name }) =>
        /token|password|url|secret/i.test(column_name),
      ),
    ).toBe(false);
    const timestampColumn = await pg.query<{ data_type: string }>(`
      SELECT data_type
      FROM information_schema.columns
      WHERE table_name = 'account_recovery_activity'
        AND column_name = 'created_at';
    `);
    expect(timestampColumn.rows).toEqual([
      { data_type: "timestamp with time zone" },
    ]);
  });
});
