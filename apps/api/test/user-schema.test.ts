import { getTableConfig } from "drizzle-orm/pg-core";
import { describe, expect, test } from "vitest";

import { user } from "../src/db/auth-schema";

describe("user schema", () => {
  test("keeps alias storage nullable during the expand release without making it unique", () => {
    const config = getTableConfig(user);

    expect(user.alias.notNull).toBe(false);
    expect(
      config.indexes.some((index) => index.config.columns.includes(user.alias)),
    ).toBe(false);
  });
});
