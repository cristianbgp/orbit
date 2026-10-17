import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  parseISO,
  startOfMonth,
  startOfWeek,
} from "date-fns";

import type {
  ProjectTaskCalendarContext,
  ProjectTaskCalendarMarker,
} from "@/lib/api/generated/models";

const dateFormat = "yyyy-MM-dd";
const monthFormat = "yyyy-MM";

export type ProjectTaskCalendarVisibleRange = {
  from: string;
  to: string;
  dates: string[];
};

export type ProjectTaskCalendarWeek = {
  index: number;
  from: string;
  to: string;
  dates: string[];
};

export type ProjectTaskCalendarSegment = {
  task: ProjectTaskCalendarContext;
  taskId: string;
  projectId: string;
  weekIndex: number;
  lane: number;
  startColumn: number;
  span: number;
  visibleStart: string;
  visibleEnd: string;
  continuesBefore: boolean;
  continuesAfter: boolean;
};

export type ProjectTaskCalendarLayout = {
  range: ProjectTaskCalendarVisibleRange;
  weeks: ProjectTaskCalendarWeek[];
  segments: ProjectTaskCalendarSegment[];
  overflowByDate: Record<string, number>;
  markersByDate: Record<string, ProjectTaskCalendarMarker[]>;
  today: { date: string; weekIndex: number; column: number } | null;
};

type PositionedTask = {
  task: ProjectTaskCalendarContext;
  clippedStart: string;
  clippedEnd: string;
  effectiveEnd: string;
  lane: number;
};

export function parseProjectTaskCalendarMonth(value: string): Date | null {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(value)) return null;

  const parsed = parseISO(`${value}-01`);
  return format(parsed, monthFormat) === value ? parsed : null;
}

export function getProjectTaskCalendarVisibleRange(
  month: string,
): ProjectTaskCalendarVisibleRange {
  const parsedMonth = parseProjectTaskCalendarMonth(month);
  if (!parsedMonth) throw new Error(`Invalid calendar month: ${month}`);

  const start = startOfWeek(startOfMonth(parsedMonth), { weekStartsOn: 1 });
  const end = endOfWeek(endOfMonth(parsedMonth), { weekStartsOn: 1 });
  const dates = eachDayOfInterval({ start, end }).map((date) =>
    format(date, dateFormat),
  );

  return { from: dates[0]!, to: dates.at(-1)!, dates };
}

export function shiftProjectTaskCalendarMonth(
  month: string,
  amount: number,
): string {
  const parsedMonth = parseProjectTaskCalendarMonth(month);
  if (!parsedMonth) throw new Error(`Invalid calendar month: ${month}`);
  return format(addMonths(parsedMonth, amount), monthFormat);
}

export function currentProjectTaskCalendarMonth(today: string): string {
  return format(parseISO(today), monthFormat);
}

function compareTasks(
  left: ProjectTaskCalendarContext,
  right: ProjectTaskCalendarContext,
) {
  const leftEnd = left.internalDueDate ?? left.plannedStartDate;
  const rightEnd = right.internalDueDate ?? right.plannedStartDate;

  return (
    left.plannedStartDate.localeCompare(right.plannedStartDate) ||
    leftEnd.localeCompare(rightEnd) ||
    left.project.name.localeCompare(right.project.name, "es") ||
    left.stage.position - right.stage.position ||
    left.position - right.position ||
    left.id.localeCompare(right.id)
  );
}

function positionTasks(
  tasks: ProjectTaskCalendarContext[],
  range: ProjectTaskCalendarVisibleRange,
): PositionedTask[] {
  const laneEnds: string[] = [];

  return [...tasks]
    .filter((task) => {
      const effectiveEnd = task.internalDueDate ?? task.plannedStartDate;
      return task.plannedStartDate <= range.to && effectiveEnd >= range.from;
    })
    .sort(compareTasks)
    .map((task) => {
      const effectiveEnd = task.internalDueDate ?? task.plannedStartDate;
      const clippedStart =
        task.plannedStartDate < range.from ? range.from : task.plannedStartDate;
      const clippedEnd = effectiveEnd > range.to ? range.to : effectiveEnd;
      const availableLane = laneEnds.findIndex(
        (occupiedThrough) => occupiedThrough < clippedStart,
      );
      const lane = availableLane === -1 ? laneEnds.length : availableLane;
      laneEnds[lane] = clippedEnd;

      return { task, clippedStart, clippedEnd, effectiveEnd, lane };
    });
}

function buildWeeks(
  range: ProjectTaskCalendarVisibleRange,
): ProjectTaskCalendarWeek[] {
  return Array.from({ length: range.dates.length / 7 }, (_, index) => {
    const dates = range.dates.slice(index * 7, index * 7 + 7);
    return { index, from: dates[0]!, to: dates[6]!, dates };
  });
}

function countHiddenTaskDates(
  positioned: PositionedTask[],
  maxVisibleLanes: number,
) {
  const overflowByDate: Record<string, number> = {};

  for (const item of positioned) {
    if (item.lane < maxVisibleLanes) continue;

    for (const date of eachDayOfInterval({
      start: parseISO(item.clippedStart),
      end: parseISO(item.clippedEnd),
    })) {
      const key = format(date, dateFormat);
      overflowByDate[key] = (overflowByDate[key] ?? 0) + 1;
    }
  }

  return overflowByDate;
}

export function layoutProjectTaskCalendar(
  tasks: ProjectTaskCalendarContext[],
  markers: ProjectTaskCalendarMarker[],
  month: string,
  today: string,
  maxVisibleLanes = 4,
): ProjectTaskCalendarLayout {
  const range = getProjectTaskCalendarVisibleRange(month);
  const weeks = buildWeeks(range);
  const positioned = positionTasks(tasks, range);
  const segments = positioned.flatMap((item) => {
    if (item.lane >= maxVisibleLanes) return [];

    return weeks.flatMap((week) => {
      if (item.clippedStart > week.to || item.clippedEnd < week.from) return [];

      const visibleStart =
        item.clippedStart > week.from ? item.clippedStart : week.from;
      const visibleEnd = item.clippedEnd < week.to ? item.clippedEnd : week.to;
      const startColumn = week.dates.indexOf(visibleStart);
      const endColumn = week.dates.indexOf(visibleEnd);

      return [
        {
          task: item.task,
          taskId: item.task.id,
          projectId: item.task.project.id,
          weekIndex: week.index,
          lane: item.lane,
          startColumn,
          span: endColumn - startColumn + 1,
          visibleStart,
          visibleEnd,
          continuesBefore: item.task.plannedStartDate < visibleStart,
          continuesAfter: item.effectiveEnd > visibleEnd,
        },
      ];
    });
  });

  const markersByDate = markers.reduce<
    Record<string, ProjectTaskCalendarMarker[]>
  >((grouped, marker) => {
    if (marker.date < range.from || marker.date > range.to) return grouped;

    grouped[marker.date] = [...(grouped[marker.date] ?? []), marker];
    return grouped;
  }, {});
  const todayIndex = range.dates.indexOf(today);

  return {
    range,
    weeks,
    segments,
    overflowByDate: countHiddenTaskDates(positioned, maxVisibleLanes),
    markersByDate,
    today:
      todayIndex === -1
        ? null
        : {
            date: today,
            weekIndex: Math.floor(todayIndex / 7),
            column: todayIndex % 7,
          },
  };
}
