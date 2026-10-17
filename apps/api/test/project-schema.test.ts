import { getTableConfig } from "drizzle-orm/pg-core";
import { describe, expect, test } from "vitest";

import { project, projectStatus, projectType } from "../src/db/project-schema";

describe("project schema", () => {
  test("defines tenant ownership, client linkage, dates, enums, and indexes", () => {
    const config = getTableConfig(project);

    expect(projectType.enumValues).toEqual([
      "written_submission",
      "consultation",
      "oral_argument",
      "other",
    ]);
    expect(projectStatus.enumValues).toEqual(["draft", "active", "completed"]);
    expect(project.organizationId.notNull).toBe(true);
    expect(project.clientId.notNull).toBe(true);
    expect(project.startDate.notNull).toBe(true);
    expect(project.endDate.notNull).toBe(true);
    expect(project).not.toHaveProperty("internalDeadline");
    expect(project).not.toHaveProperty("legalDeadline");
    expect(project.archivedAt.notNull).toBe(false);
    expect(config.foreignKeys).toHaveLength(2);
    expect(config.indexes.map((index) => index.config.name)).toEqual(
      expect.arrayContaining([
        "project_organization_id_idx",
        "project_organization_client_idx",
        "project_organization_name_idx",
      ]),
    );
    expect(config.indexes.map((index) => index.config.name)).not.toEqual(
      expect.arrayContaining([
        "project_organization_legal_deadline_idx",
        "project_organization_archived_legal_deadline_idx",
      ]),
    );
  });
});
