import type {
  ProjectTaskScheduleResponse,
  ProjectTaskScheduleTask,
} from "@/lib/api/generated/models";

const MILLISECONDS_PER_DAY = 86_400_000;

export const TIMELINE_LABEL_WIDTH = 224;

type TimelineScrollInput = {
  today: string;
  startDate: string;
  endDate: string;
  viewportWidth: number;
  contentWidth: number;
  labelWidth: number;
  dayWidth: number;
};

function calendarDayNumber(date: string) {
  return Date.parse(`${date}T00:00:00Z`) / MILLISECONDS_PER_DAY;
}

function calendarDateFromDayNumber(day: number) {
  return new Date(day * MILLISECONDS_PER_DAY).toISOString().slice(0, 10);
}

export function timelineDayOffset(
  date: string,
  startDay: number,
  dayWidth: number,
) {
  return (calendarDayNumber(date) - startDay) * dayWidth;
}

export function timelineTaskRange(
  task: Pick<ProjectTaskScheduleTask, "plannedStartDate" | "internalDueDate">,
) {
  const dates = [task.plannedStartDate, task.internalDueDate]
    .filter((date): date is string => Boolean(date))
    .sort();
  if (dates.length === 0) return null;

  return {
    startDate: dates[0],
    endDate: dates.at(-1)!,
  };
}

export function calendarDateInTimeZone(instant: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(instant);
  const values = Object.fromEntries(
    parts
      .filter(({ type }) => type !== "literal")
      .map(({ type, value }) => [type, value]),
  );

  return `${values.year}-${values.month}-${values.day}`;
}

export function initialTimelineScrollLeft({
  today,
  startDate,
  endDate,
  viewportWidth,
  contentWidth,
  labelWidth,
  dayWidth,
}: TimelineScrollInput) {
  const maximum = Math.max(0, contentWidth - viewportWidth);
  if (today < startDate) return 0;
  if (today > endDate) return maximum;

  const todayIndex = calendarDayNumber(today) - calendarDayNumber(startDate);
  const todayCenter = todayIndex * dayWidth + dayWidth / 2;
  const visibleTimelineWidth = Math.max(0, viewportWidth - labelWidth);
  const target = todayCenter - visibleTimelineWidth * 0.4;

  return Math.min(maximum, Math.max(0, target));
}

export function buildTimelineCalendar(
  schedule: ProjectTaskScheduleResponse,
  { extraEndDays = 0 }: { extraEndDays?: number } = {},
) {
  const startDay = calendarDayNumber(schedule.project.startDate);
  const stageEndDays = schedule.stages.flatMap((stage) =>
    stage.endDate ? [calendarDayNumber(stage.endDate)] : [],
  );
  const taskDateDays = schedule.stages.flatMap((stage) =>
    stage.tasks.flatMap((task) =>
      [task.plannedStartDate, task.internalDueDate]
        .filter((date): date is string => Boolean(date))
        .map(calendarDayNumber),
    ),
  );
  const scheduleEndDay = Math.max(
    calendarDayNumber(schedule.project.endDate),
    ...(schedule.events ?? []).map((event) => calendarDayNumber(event.date)),
    ...stageEndDays,
    ...taskDateDays,
  );
  const endDay = scheduleEndDay + Math.max(0, Math.floor(extraEndDays));
  const days = Array.from({ length: endDay - startDay + 1 }, (_, index) => {
    const dayNumber = startDay + index;
    const weekday = new Date(dayNumber * MILLISECONDS_PER_DAY).getUTCDay();

    return {
      date: calendarDateFromDayNumber(dayNumber),
      isWeekend: weekday === 0 || weekday === 6,
    };
  });

  return {
    startDay,
    endDate: calendarDateFromDayNumber(endDay),
    days,
  };
}
