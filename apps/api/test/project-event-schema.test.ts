import { getTableConfig } from "drizzle-orm/pg-core";
import { describe, expect, test } from "vitest";

import { projectEvent, projectEventType } from "../src/db/project-event-schema";

describe("project event schema", () => {
  test("defines tenant-scoped dated events with future-ready types", () => {
    const config = getTableConfig(projectEvent);

    expect(projectEventType.enumValues).toEqual(["legal", "meeting", "other"]);
    expect(projectEvent.organizationId.notNull).toBe(true);
    expect(projectEvent.projectId.notNull).toBe(true);
    expect(projectEvent.title.notNull).toBe(true);
    expect(projectEvent.type.notNull).toBe(true);
    expect(projectEvent.date.notNull).toBe(true);
    expect(projectEvent.description.notNull).toBe(false);
    expect(projectEvent.createdByUserId.notNull).toBe(false);
    expect(projectEvent.createdAt.notNull).toBe(true);
    expect(projectEvent.updatedAt.notNull).toBe(true);
    expect(config.foreignKeys).toHaveLength(3);
    expect(config.foreignKeys.map((key) => key.onDelete)).toEqual(
      expect.arrayContaining(["cascade", "cascade", "set null"]),
    );
    expect(config.indexes.map((index) => index.config.name)).toEqual(
      expect.arrayContaining([
        "project_event_organization_project_date_idx",
        "project_event_organization_date_type_idx",
      ]),
    );
  });
});
