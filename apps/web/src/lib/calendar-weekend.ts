export const weekendDayMatcher = { dayOfWeek: [0, 6] };

export function isWeekendCalendarDate(date: string) {
  const weekday = new Date(`${date}T00:00:00Z`).getUTCDay();
  return weekday === 0 || weekday === 6;
}
