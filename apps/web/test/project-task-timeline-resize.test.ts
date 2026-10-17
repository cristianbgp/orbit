import { describe, expect, test } from "vitest";

import {
  nextTimelineResizeHorizon,
  resizeTimelineTaskDates,
  timelineResizeDeltaDays,
} from "@/features/projects/project-task-timeline-resize";

describe("project task timeline resize", () => {
  test("derives whole-day movement from fractional width and auto-scroll", () => {
    expect(
      timelineResizeDeltaDays({
        pointerClientX: 335,
        initialPointerClientX: 200,
        scrollLeft: 467.5,
        initialScrollLeft: 400,
        frozenDayWidth: 67.5,
      }),
    ).toBe(3);
  });

  test.each([
    {
      edge: "start" as const,
      deltaDays: -10,
      expected: {
        plannedStartDate: "2026-08-06",
        internalDueDate: "2026-08-15",
      },
    },
    {
      edge: "start" as const,
      deltaDays: 10,
      expected: {
        plannedStartDate: "2026-08-15",
        internalDueDate: "2026-08-15",
      },
    },
    {
      edge: "end" as const,
      deltaDays: -10,
      expected: {
        plannedStartDate: "2026-08-10",
        internalDueDate: "2026-08-10",
      },
    },
    {
      edge: "end" as const,
      deltaDays: 5,
      expected: {
        plannedStartDate: "2026-08-10",
        internalDueDate: "2026-08-20",
      },
    },
  ])("resizes and clamps the $edge edge", ({ edge, deltaDays, expected }) => {
    expect(
      resizeTimelineTaskDates({
        edge,
        deltaDays,
        projectStartDate: "2026-08-06",
        plannedStartDate: "2026-08-10",
        internalDueDate: "2026-08-15",
      }),
    ).toEqual(expected);
  });

  test("extends a start-only task from either edge", () => {
    expect(
      resizeTimelineTaskDates({
        edge: "start",
        deltaDays: -2,
        projectStartDate: "2026-08-06",
        plannedStartDate: "2026-08-10",
        internalDueDate: null,
      }),
    ).toEqual({
      plannedStartDate: "2026-08-08",
      internalDueDate: null,
    });
    expect(
      resizeTimelineTaskDates({
        edge: "end",
        deltaDays: 3,
        projectStartDate: "2026-08-06",
        plannedStartDate: "2026-08-10",
        internalDueDate: null,
      }),
    ).toEqual({
      plannedStartDate: "2026-08-10",
      internalDueDate: "2026-08-13",
    });
    expect(
      resizeTimelineTaskDates({
        edge: "end",
        deltaDays: -1,
        projectStartDate: "2026-08-06",
        plannedStartDate: "2026-08-10",
        internalDueDate: null,
      }),
    ).toEqual({
      plannedStartDate: "2026-08-10",
      internalDueDate: null,
    });
  });

  test("normalizes a legacy due-only task when either edge changes", () => {
    expect(
      resizeTimelineTaskDates({
        edge: "start",
        deltaDays: -2,
        projectStartDate: "2026-08-06",
        plannedStartDate: null,
        internalDueDate: "2026-08-12",
      }),
    ).toEqual({
      plannedStartDate: "2026-08-10",
      internalDueDate: "2026-08-12",
    });
    expect(
      resizeTimelineTaskDates({
        edge: "end",
        deltaDays: 3,
        projectStartDate: "2026-08-06",
        plannedStartDate: null,
        internalDueDate: "2026-08-12",
      }),
    ).toEqual({
      plannedStartDate: "2026-08-12",
      internalDueDate: "2026-08-15",
    });
  });

  test("grows the temporary horizon in fourteen-day batches near its end", () => {
    expect(
      nextTimelineResizeHorizon({
        baseDayCount: 20,
        extraEndDays: 14,
        provisionalDayIndex: 30,
      }),
    ).toBe(14);
    expect(
      nextTimelineResizeHorizon({
        baseDayCount: 20,
        extraEndDays: 14,
        provisionalDayIndex: 32,
      }),
    ).toBe(28);
  });
});
