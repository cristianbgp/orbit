import { createContext, useContext, useMemo, type ReactNode } from "react";

import { CalendarTodayProvider } from "@/components/ui/calendar-today-context";

type OrganizationCalendar = {
  timeZone: string;
  today: string;
};

const OrganizationCalendarContext = createContext<OrganizationCalendar | null>(
  null,
);

export function calendarDateInOrganizationTimeZone(
  instant: Date,
  timeZone: string,
) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(instant);
  const value = Object.fromEntries(
    parts.map((part) => [part.type, part.value]),
  );
  return `${value.year}-${value.month}-${value.day}`;
}

export function OrganizationCalendarProvider({
  timeZone,
  now = new Date(),
  children,
}: {
  timeZone: string;
  now?: Date;
  children: ReactNode;
}) {
  const today = calendarDateInOrganizationTimeZone(now, timeZone);
  const value = useMemo(() => ({ timeZone, today }), [timeZone, today]);

  return (
    <OrganizationCalendarContext.Provider value={value}>
      <CalendarTodayProvider today={today}>{children}</CalendarTodayProvider>
    </OrganizationCalendarContext.Provider>
  );
}

export function useOrganizationCalendar() {
  const calendar = useContext(OrganizationCalendarContext);
  if (!calendar) {
    throw new Error(
      "useOrganizationCalendar must be used within OrganizationCalendarProvider",
    );
  }
  return calendar;
}
