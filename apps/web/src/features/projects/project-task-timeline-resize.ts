const MILLISECONDS_PER_DAY = 86_400_000;
const TIMELINE_RESIZE_HORIZON_DAYS = 14;

export type TimelineResizeEdge = "start" | "end";

export type TimelineTaskDateRange = {
  plannedStartDate: string | null;
  internalDueDate: string | null;
};

function calendarDayNumber(date: string) {
  return Date.parse(`${date}T00:00:00Z`) / MILLISECONDS_PER_DAY;
}

function calendarDateFromDayNumber(day: number) {
  return new Date(day * MILLISECONDS_PER_DAY).toISOString().slice(0, 10);
}

function addCalendarDays(date: string, days: number) {
  return calendarDateFromDayNumber(calendarDayNumber(date) + days);
}

function laterDate(left: string, right: string) {
  return left > right ? left : right;
}

function earlierDate(left: string, right: string) {
  return left < right ? left : right;
}

export function timelineResizeDeltaDays({
  pointerClientX,
  initialPointerClientX,
  scrollLeft,
  initialScrollLeft,
  frozenDayWidth,
}: {
  pointerClientX: number;
  initialPointerClientX: number;
  scrollLeft: number;
  initialScrollLeft: number;
  frozenDayWidth: number;
}) {
  if (frozenDayWidth <= 0) return 0;
  return Math.round(
    (pointerClientX - initialPointerClientX + scrollLeft - initialScrollLeft) /
      frozenDayWidth,
  );
}

export function resizeTimelineTaskDates({
  edge,
  deltaDays,
  projectStartDate,
  plannedStartDate,
  internalDueDate,
}: TimelineTaskDateRange & {
  edge: TimelineResizeEdge;
  deltaDays: number;
  projectStartDate: string;
}): TimelineTaskDateRange {
  const effectiveStart = plannedStartDate ?? internalDueDate;
  const effectiveEnd = internalDueDate ?? plannedStartDate;
  if (!effectiveStart || !effectiveEnd) {
    return { plannedStartDate, internalDueDate };
  }

  if (edge === "start") {
    const candidate = addCalendarDays(effectiveStart, deltaDays);
    return {
      plannedStartDate: earlierDate(
        laterDate(candidate, projectStartDate),
        effectiveEnd,
      ),
      internalDueDate,
    };
  }

  const candidate = addCalendarDays(effectiveEnd, deltaDays);
  if (!internalDueDate && candidate <= effectiveStart) {
    return { plannedStartDate, internalDueDate };
  }
  return {
    plannedStartDate: plannedStartDate ?? effectiveStart,
    internalDueDate: laterDate(candidate, effectiveStart),
  };
}

export function nextTimelineResizeHorizon({
  baseDayCount,
  extraEndDays,
  provisionalDayIndex,
}: {
  baseDayCount: number;
  extraEndDays: number;
  provisionalDayIndex: number;
}) {
  const renderedDayCount = baseDayCount + extraEndDays;
  return provisionalDayIndex >= renderedDayCount - 2
    ? extraEndDays + TIMELINE_RESIZE_HORIZON_DAYS
    : extraEndDays;
}

export { TIMELINE_RESIZE_HORIZON_DAYS };
