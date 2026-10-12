import { getTableConfig } from "drizzle-orm/pg-core";
import { describe, expect, test } from "vitest";

import {
  projectActivity,
  projectAssignment,
  projectAssignmentEndReason,
  projectResponsibility,
} from "../src/db/project-collaboration-schema";

describe("project collaboration schema", () => {
  test("preserves assignment periods and immutable structured activity", () => {
    const assignmentConfig = getTableConfig(projectAssignment);
    const activityConfig = getTableConfig(projectActivity);

    expect(projectResponsibility.enumValues).toEqual(["responsible", "member"]);
    expect(projectAssignmentEndReason.enumValues).toEqual([
      "project_unassigned",
      "organization_removed",
    ]);
    expect(projectAssignment.organizationId.notNull).toBe(true);
    expect(projectAssignment.projectId.notNull).toBe(true);
    expect(projectAssignment.userId.notNull).toBe(false);
    expect(projectAssignment.userNameSnapshot.notNull).toBe(true);
    expect(projectAssignment.userEmailSnapshot.notNull).toBe(true);
    expect(projectAssignment.responsibility.notNull).toBe(true);
    expect(projectAssignment.endedAt.notNull).toBe(false);
    expect(projectAssignment.endReason.notNull).toBe(false);
    expect(projectActivity.organizationId.notNull).toBe(true);
    expect(projectActivity.projectId.notNull).toBe(true);
    expect(projectActivity.type.notNull).toBe(true);
    expect(projectActivity.actorNameSnapshot.notNull).toBe(true);
    expect(projectActivity.details.dataType).toBe("json");
    expect(assignmentConfig.indexes.map((index) => index.config.name)).toEqual(
      expect.arrayContaining([
        "project_assignment_active_user_unique",
        "project_assignment_project_responsibility_idx",
        "project_assignment_project_ended_idx",
      ]),
    );
    expect(activityConfig.indexes.map((index) => index.config.name)).toContain(
      "project_activity_project_created_idx",
    );
  });
});
