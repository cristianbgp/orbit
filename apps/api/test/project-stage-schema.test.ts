import { getTableConfig } from "drizzle-orm/pg-core";
import { describe, expect, test } from "vitest";

import { projectStage } from "../src/db/project-stage-schema";

describe("project stage schema", () => {
  test("defines tenant-scoped ordered project stages", () => {
    const config = getTableConfig(projectStage);

    expect(projectStage.organizationId.notNull).toBe(true);
    expect(projectStage.projectId.notNull).toBe(true);
    expect(projectStage.name.notNull).toBe(true);
    expect(projectStage.position.notNull).toBe(true);
    expect(config.foreignKeys).toHaveLength(2);
    expect(config.foreignKeys.map((key) => key.onDelete)).toContain("cascade");
    expect(config.indexes.map((index) => index.config.name)).toContain(
      "project_stage_organization_project_position_idx",
    );
  });
});
