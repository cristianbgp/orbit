import { describe, expect, test } from "vitest";

import {
  buildTimelineCalendar,
  calendarDateInTimeZone,
  initialTimelineScrollLeft,
  timelineTaskRange,
  timelineDayOffset,
} from "@/features/projects/project-task-timeline-calendar";
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
      scheduledTaskCount: 2,
      taskStatusCounts: {
        pending: 1,
        inProgress: 1,
        blocked: 0,
        completed: 0,
      },
      tasks: [
        {
          id: "task-1",
          title: "Revisar antecedentes",
          status: "in_progress",
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
      startDate: "2026-08-22",
      endDate: "2026-08-28",
      scheduledTaskCount: 1,
      taskStatusCounts: {
        pending: 0,
        inProgress: 0,
        blocked: 0,
        completed: 1,
      },
      tasks: [
        {
          id: "task-2",
          title: "Preparar informe",
          status: "completed",
          plannedStartDate: "2026-08-30",
          internalDueDate: null,
          position: 0,
        },
      ],
      usesProjectStartFallback: false,
    },
  ],
};

describe("project task timeline calendar", () => {
  test("extends its inclusive range through a start-only task after project deadlines", () => {
    const calendar = buildTimelineCalendar(schedule);

    expect(calendar.endDate).toBe("2026-08-30");
    expect(calendar.days).toHaveLength(25);
    expect(calendar.days.at(0)?.date).toBe("2026-08-06");
    expect(calendar.days.at(-1)?.date).toBe("2026-08-30");
  });

  test("adds presentation-only days without changing the schedule", () => {
    const originalEndDate = schedule.project.endDate;
    const calendar = buildTimelineCalendar(schedule, { extraEndDays: 14 });

    expect(calendar.endDate).toBe("2026-09-13");
    expect(calendar.days).toHaveLength(39);
    expect(schedule.project.endDate).toBe(originalEndDate);
  });

  test.each([
    {
      task: { plannedStartDate: "2026-08-08", internalDueDate: "2026-08-12" },
      expected: { startDate: "2026-08-08", endDate: "2026-08-12" },
    },
    {
      task: { plannedStartDate: "2026-08-08", internalDueDate: null },
      expected: { startDate: "2026-08-08", endDate: "2026-08-08" },
    },
    {
      task: { plannedStartDate: null, internalDueDate: "2026-08-12" },
      expected: { startDate: "2026-08-12", endDate: "2026-08-12" },
    },
    {
      task: { plannedStartDate: null, internalDueDate: null },
      expected: null,
    },
  ])("derives the visible task range for $task", ({ task, expected }) => {
    expect(timelineTaskRange(task)).toEqual(expected);
  });

  test("uses the supplied daily width for every calendar offset", () => {
    const calendar = buildTimelineCalendar(schedule);

    expect(timelineDayOffset("2026-08-06", calendar.startDay, 40)).toBe(0);
    expect(timelineDayOffset("2026-08-07", calendar.startDay, 40)).toBe(40);
    expect(timelineDayOffset("2026-08-07", calendar.startDay, 112)).toBe(112);
    expect(timelineDayOffset("2026-08-28", calendar.startDay, 56)).toBe(1_232);
  });

  test("derives today from the organization timezone", () => {
    const instant = new Date("2026-08-10T04:30:00.000Z");

    expect(calendarDateInTimeZone(instant, "America/Lima")).toBe("2026-08-09");
    expect(calendarDateInTimeZone(instant, "Asia/Tokyo")).toBe("2026-08-10");
  });

  test.each([
    { today: "2026-08-01", expected: 0 },
    { today: "2026-08-10", expected: 168 },
    { today: "2026-09-01", expected: 1_360 },
  ])("clamps the initial scroll target for $today", ({ today, expected }) => {
    expect(
      initialTimelineScrollLeft({
        today,
        startDate: "2026-08-06",
        endDate: "2026-08-28",
        viewportWidth: 640,
        contentWidth: 2_000,
        labelWidth: 160,
        dayWidth: 80,
      }),
    ).toBe(expected);
  });
});
