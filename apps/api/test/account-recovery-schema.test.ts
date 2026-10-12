import { getTableConfig } from "drizzle-orm/pg-core";
import { describe, expect, test } from "vitest";

import { accountRecoveryActivity } from "../src/db/account-recovery-schema";

describe("account recovery activity schema", () => {
  test("stores a secret-free immutable security audit", () => {
    const config = getTableConfig(accountRecoveryActivity);
    const columns = config.columns.map((column) => column.name).sort();

    expect(columns).toEqual([
      "actor_name_snapshot",
      "actor_user_id",
      "created_at",
      "id",
      "organization_id",
      "subject_email_snapshot",
      "subject_name_snapshot",
      "subject_user_id",
      "type",
    ]);
    expect(
      columns.some((column) => /token|password|url|secret/i.test(column)),
    ).toBe(false);
    expect(accountRecoveryActivity.createdAt.dataType).toBe("date");
    expect(config.indexes.map((index) => index.config.name).sort()).toEqual([
      "account_recovery_activity_organization_created_idx",
      "account_recovery_activity_subject_created_idx",
    ]);
  });
});
