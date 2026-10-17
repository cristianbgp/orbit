import { createContext, useContext, type ReactNode } from "react";

const CalendarTodayContext = createContext<string | null>(null);

export function CalendarTodayProvider({
  today,
  children,
}: {
  today: string;
  children: ReactNode;
}) {
  return (
    <CalendarTodayContext.Provider value={today}>
      {children}
    </CalendarTodayContext.Provider>
  );
}

export function useCalendarToday() {
  return useContext(CalendarTodayContext);
}
