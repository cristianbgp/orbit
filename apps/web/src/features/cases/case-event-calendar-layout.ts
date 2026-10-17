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

import { isWeekendCalendarDate } from "@/lib/calendar-weekend";
import type { CaseEventCalendarItem } from "@/lib/api/generated/models";

const dateFormat = "yyyy-MM-dd";
const monthFormat = "yyyy-MM";

export type CaseEventCalendarVisibleRange = {
  from: string;
  to: string;
  dates: string[];
};

export type CaseEventCalendarDay = {
  date: string;
  events: CaseEventCalendarItem[];
  visible: CaseEventCalendarItem[];
  overflow: number;
  isWeekend: boolean;
  outsideMonth: boolean;
  isToday: boolean;
};

export type CaseEventCalendarWeek = {
  index: number;
  from: string;
  to: string;
  dates: string[];
};

export type CaseEventCalendarLayout = {
  range: CaseEventCalendarVisibleRange;
  weeks: CaseEventCalendarWeek[];
  daysByDate: Record<string, CaseEventCalendarDay>;
};

export function parseCaseEventCalendarMonth(value: string): Date | null {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(value)) return null;
  const parsed = parseISO(`${value}-01`);
  return format(parsed, monthFormat) === value ? parsed : null;
}

export function getCaseEventCalendarVisibleRange(
  month: string,
): CaseEventCalendarVisibleRange {
  const parsedMonth = parseCaseEventCalendarMonth(month);
  if (!parsedMonth) throw new Error(`Invalid calendar month: ${month}`);
  const start = startOfWeek(startOfMonth(parsedMonth), { weekStartsOn: 1 });
  const end = endOfWeek(endOfMonth(parsedMonth), { weekStartsOn: 1 });
  const dates = eachDayOfInterval({ start, end }).map((date) =>
    format(date, dateFormat),
  );
  return { from: dates[0]!, to: dates.at(-1)!, dates };
}

export function shiftCaseEventCalendarMonth(month: string, amount: number) {
  const parsedMonth = parseCaseEventCalendarMonth(month);
  if (!parsedMonth) throw new Error(`Invalid calendar month: ${month}`);
  return format(addMonths(parsedMonth, amount), monthFormat);
}

export function currentCaseEventCalendarMonth(today: string) {
  return format(parseISO(today), monthFormat);
}

function compareEvents(
  left: CaseEventCalendarItem,
  right: CaseEventCalendarItem,
) {
  return (
    left.date.localeCompare(right.date) ||
    left.title.localeCompare(right.title, "es") ||
    left.case.identification.localeCompare(right.case.identification, "es") ||
    left.id.localeCompare(right.id)
  );
}

export function layoutCaseEventCalendar(
  events: CaseEventCalendarItem[],
  month: string,
  today: string,
  maxVisibleEvents = 4,
): CaseEventCalendarLayout {
  const range = getCaseEventCalendarVisibleRange(month);
  const grouped = [...events]
    .filter(({ date }) => date >= range.from && date <= range.to)
    .sort(compareEvents)
    .reduce<Record<string, CaseEventCalendarItem[]>>((result, event) => {
      result[event.date] = [...(result[event.date] ?? []), event];
      return result;
    }, {});
  const daysByDate = Object.fromEntries(
    range.dates.map((date) => {
      const dayEvents = grouped[date] ?? [];
      return [
        date,
        {
          date,
          events: dayEvents,
          visible: dayEvents.slice(0, maxVisibleEvents),
          overflow: Math.max(0, dayEvents.length - maxVisibleEvents),
          isWeekend: isWeekendCalendarDate(date),
          outsideMonth: !date.startsWith(month),
          isToday: date === today,
        },
      ];
    }),
  );
  const weeks = Array.from({ length: range.dates.length / 7 }, (_, index) => {
    const dates = range.dates.slice(index * 7, index * 7 + 7);
    return { index, from: dates[0]!, to: dates[6]!, dates };
  });
  return { range, weeks, daysByDate };
}
