const calendarWeekdayFormatter = new Intl.DateTimeFormat("es-PE", {
  weekday: "long",
  timeZone: "UTC",
});

export function formatCalendarWeekday(value: string) {
  return calendarWeekdayFormatter.format(new Date(`${value}T00:00:00.000Z`));
}
