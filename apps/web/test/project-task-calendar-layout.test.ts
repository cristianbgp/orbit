import { describe, expect, test } from "vitest";

import {
  getProjectTaskCalendarVisibleRange,
  layoutProjectTaskCalendar,
} from "@/features/projects/project-task-calendar-layout";
import type {
  ProjectTaskCalendarContext,
  ProjectTaskCalendarMarker,
} from "@/lib/api/generated/models";

function task(
  id: string,
  plannedStartDate: string,
  internalDueDate: string | null = null,
  overrides: Partial<ProjectTaskCalendarContext> = {},
): ProjectTaskCalendarContext {
  return {
    id,
    title: `Tarea ${id}`,
    status: "pending",
    internalDueDate,
    position: 0,
    project: {
      id: "project-1",
      name: "Apelación",
      startDate: "2026-08-01",
      client: { id: "client-1", name: "Cliente Uno" },
    },
    stage: { id: "stage-1", name: "Redacción", position: 0 },
    responsibles: [],
    plannedStartDate,
    ...overrides,
  };
}

describe("layoutProjectTaskCalendar", () => {
  test("builds the complete Monday-first visible month range", () => {
    expect(getProjectTaskCalendarVisibleRange("2026-08")).toMatchObject({
      from: "2026-07-27",
      to: "2026-09-06",
    });
  });

  test("lays out one-day and inclusive cross-week task periods", () => {
    const layout = layoutProjectTaskCalendar(
      [
        task("one-day", "2026-08-11"),
        task("cross-week", "2026-08-08", "2026-08-11"),
      ],
      [],
      "2026-08",
      "2026-08-11",
    );

    expect(
      layout.segments.find(
        ({ taskId, weekIndex }) => taskId === "one-day" && weekIndex === 2,
      ),
    ).toMatchObject({ startColumn: 1, span: 1 });
    expect(
      layout.segments.find(
        ({ taskId, weekIndex }) => taskId === "cross-week" && weekIndex === 1,
      ),
    ).toMatchObject({
      startColumn: 5,
      span: 2,
      continuesBefore: false,
      continuesAfter: true,
    });
    expect(
      layout.segments.find(
        ({ taskId, weekIndex }) => taskId === "cross-week" && weekIndex === 2,
      ),
    ).toMatchObject({
      startColumn: 0,
      span: 2,
      continuesBefore: true,
      continuesAfter: false,
    });
  });

  test("clips tasks to the visible calendar without losing continuation state", () => {
    const layout = layoutProjectTaskCalendar(
      [task("long", "2026-07-20", "2026-09-12")],
      [],
      "2026-08",
      "2026-08-11",
    );

    expect(layout.segments[0]).toMatchObject({
      visibleStart: "2026-07-27",
      continuesBefore: true,
      continuesAfter: true,
    });
    expect(layout.segments.at(-1)).toMatchObject({
      visibleEnd: "2026-09-06",
      continuesBefore: true,
      continuesAfter: true,
    });
  });

  test("assigns deterministic lanes from operational task order", () => {
    const tasks = [
      task("later-project", "2026-08-10", "2026-08-12", {
        project: {
          id: "project-z",
          name: "Zeta",
          startDate: "2026-08-01",
          client: { id: "client-z", name: "Cliente Z" },
        },
      }),
      task("first-project", "2026-08-10", "2026-08-12", {
        project: {
          id: "project-a",
          name: "Alfa",
          startDate: "2026-08-01",
          client: { id: "client-a", name: "Cliente A" },
        },
      }),
      task("earliest", "2026-08-09", "2026-08-10"),
    ];

    const forward = layoutProjectTaskCalendar(
      tasks,
      [],
      "2026-08",
      "2026-08-11",
    );
    const reversed = layoutProjectTaskCalendar(
      [...tasks].reverse(),
      [],
      "2026-08",
      "2026-08-11",
    );
    const lanes = (layout: typeof forward) =>
      Object.fromEntries(
        layout.segments
          .filter(({ weekIndex }) => weekIndex === 2)
          .map(({ taskId, lane }) => [taskId, lane]),
      );

    expect(lanes(forward)).toEqual(lanes(reversed));
    expect(lanes(forward)).toEqual({
      earliest: 0,
      "first-project": 1,
      "later-project": 2,
    });
  });

  test("caps visible lanes and counts every hidden task on each affected day", () => {
    const tasks = Array.from({ length: 7 }, (_, index) =>
      task(`overlap-${index}`, "2026-08-10", "2026-08-12", {
        position: index,
      }),
    );
    const layout = layoutProjectTaskCalendar(
      tasks,
      [],
      "2026-08",
      "2026-08-11",
      4,
    );

    expect(new Set(layout.segments.map(({ lane }) => lane))).toEqual(
      new Set([0, 1, 2, 3]),
    );
    expect(layout.overflowByDate).toMatchObject({
      "2026-08-10": 3,
      "2026-08-11": 3,
      "2026-08-12": 3,
    });
    expect(layout.overflowByDate["2026-08-13"]).toBeUndefined();
  });

  test("groups project period and event markers by date and locates today when it is visible", () => {
    const markers: ProjectTaskCalendarMarker[] = [
      {
        projectId: "project-1",
        projectName: "Apelación",
        clientName: "Cliente Uno",
        kind: "project_start",
        date: "2026-08-11",
      },
      {
        projectId: "project-2",
        projectName: "Consulta",
        clientName: "Cliente Dos",
        kind: "project_end",
        date: "2026-08-11",
      },
      {
        projectId: "project-2",
        projectName: "Consulta",
        clientName: "Cliente Dos",
        kind: "project_event",
        date: "2026-08-11",
        eventId: "event-1",
        eventTitle: "Audiencia",
        eventType: "legal",
      },
    ];

    const layout = layoutProjectTaskCalendar(
      [],
      markers,
      "2026-08",
      "2026-08-11",
    );

    expect(layout.markersByDate["2026-08-11"]).toEqual(markers);
    expect(layout.today).toEqual({
      date: "2026-08-11",
      weekIndex: 2,
      column: 1,
    });
    expect(
      layoutProjectTaskCalendar([], [], "2026-08", "2027-01-01").today,
    ).toBeNull();
  });
});
