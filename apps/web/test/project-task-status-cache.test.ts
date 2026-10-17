import { describe, expect, test } from "vitest";

import { updateTaskStatusInSchedule } from "@/features/projects/project-task-status-cache";
import { deriveProjectStageStatus } from "@/features/projects/project-stage-status";
import type { ProjectTaskScheduleResponse } from "@/lib/api/generated/models";

const schedule: ProjectTaskScheduleResponse = {
  project: {
    startDate: "2026-08-06",
    endDate: "2026-08-20",
    timeZone: "America/Lima",
  },
  events: [],
  stages: [
    {
      id: "stage-1",
      name: "Investigación",
      position: 0,
      startDate: "2026-08-06",
      endDate: "2026-08-12",
      scheduledTaskCount: 1,
      taskStatusCounts: {
        pending: 1,
        inProgress: 0,
        blocked: 0,
        completed: 0,
      },
      tasks: [
        {
          id: "task-1",
          title: "Revisar antecedentes",
          status: "pending",
          plannedStartDate: "2026-08-06",
          internalDueDate: "2026-08-12",
          position: 0,
        },
      ],
      usesProjectStartFallback: true,
    },
    {
      id: "stage-2",
      name: "Informe",
      position: 1,
      startDate: null,
      endDate: null,
      scheduledTaskCount: 0,
      taskStatusCounts: {
        pending: 0,
        inProgress: 0,
        blocked: 0,
        completed: 0,
      },
      tasks: [],
      usesProjectStartFallback: false,
    },
  ],
};

describe("updateTaskStatusInSchedule", () => {
  test("updates the task and transfers its aggregate stage count", () => {
    const updated = updateTaskStatusInSchedule(schedule, "task-1", "completed");

    expect(updated).not.toBe(schedule);
    expect(updated.stages[0].tasks[0].status).toBe("completed");
    expect(updated.stages[0].taskStatusCounts).toEqual({
      pending: 0,
      inProgress: 0,
      blocked: 0,
      completed: 1,
    });
    expect(deriveProjectStageStatus(updated.stages[0].taskStatusCounts)).toBe(
      "completed",
    );
    expect(updated.stages[1]).toBe(schedule.stages[1]);
    expect(schedule.stages[0].tasks[0].status).toBe("pending");
  });

  test("returns the same schedule for a missing task or unchanged status", () => {
    expect(updateTaskStatusInSchedule(schedule, "missing", "completed")).toBe(
      schedule,
    );
    expect(updateTaskStatusInSchedule(schedule, "task-1", "pending")).toBe(
      schedule,
    );
  });
});
