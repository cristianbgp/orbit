import { getTableConfig } from "drizzle-orm/pg-core";
import { describe, expect, test } from "vitest";

import {
  projectTask,
  projectTaskStatus,
  taskAssignment,
  taskAssignmentEndReason,
} from "../src/db/project-task-schema";

describe("project task schema", () => {
  test("stores archivable tasks and historical responsibility periods", () => {
    const taskConfig = getTableConfig(projectTask);
    const assignmentConfig = getTableConfig(taskAssignment);

    expect(projectTaskStatus.enumValues).toEqual([
      "pending",
      "in_progress",
      "blocked",
      "completed",
    ]);
    expect(taskAssignmentEndReason.enumValues).toEqual([
      "task_unassigned",
      "project_unassigned",
      "organization_removed",
    ]);
    expect(projectTask.organizationId.notNull).toBe(true);
    expect(projectTask.projectId.notNull).toBe(true);
    expect(projectTask.stageId.notNull).toBe(true);
    expect(projectTask.title.notNull).toBe(true);
    expect(projectTask.status.notNull).toBe(true);
    expect(projectTask.plannedStartDate.dataType).toBe("string");
    expect(projectTask.plannedStartDate.notNull).toBe(false);
    expect(projectTask.internalDueDate.notNull).toBe(false);
    expect(projectTask.archivedAt.notNull).toBe(false);
    expect(projectTask.createdByNameSnapshot.notNull).toBe(true);
    expect(taskAssignment.organizationId.notNull).toBe(true);
    expect(taskAssignment.projectId.notNull).toBe(true);
    expect(taskAssignment.taskId.notNull).toBe(true);
    expect(taskAssignment.userId.notNull).toBe(false);
    expect(taskAssignment.userNameSnapshot.notNull).toBe(true);
    expect(taskAssignment.endedAt.notNull).toBe(false);
    expect(taskAssignment.endReason.notNull).toBe(false);
    expect(taskConfig.indexes.map((index) => index.config.name)).toEqual(
      expect.arrayContaining([
        "project_task_active_order_idx",
        "project_task_archived_order_idx",
        "project_task_stage_reference_idx",
      ]),
    );
    expect(assignmentConfig.indexes.map((index) => index.config.name)).toEqual(
      expect.arrayContaining([
        "task_assignment_active_user_unique",
        "task_assignment_task_active_idx",
        "task_assignment_task_history_idx",
      ]),
    );
  });
});
