import { getTableConfig } from "drizzle-orm/pg-core";
import { describe, expect, test } from "vitest";

import { client, clientType } from "../src/db/client-schema";

describe("client schema", () => {
  test("defines organization ownership and supported client types", () => {
    const config = getTableConfig(client);

    expect(client.organizationId).toBeDefined();
    expect(client.name.notNull).toBe(true);
    expect(clientType.enumValues).toEqual(["person", "company"]);
    expect(config.foreignKeys).toHaveLength(1);
    expect(config.indexes.map((index) => index.config.name)).toEqual(
      expect.arrayContaining([
        "client_organization_id_idx",
        "client_organization_name_idx",
        "client_organization_document_idx",
      ]),
    );
  });
});
