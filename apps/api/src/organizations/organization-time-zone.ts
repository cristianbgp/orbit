export const DEFAULT_ORGANIZATION_TIME_ZONE = "America/Lima";

export function calendarDateInTimeZone(instant: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(instant);
  const value = Object.fromEntries(
    parts
      .filter(
        ({ type }) => type === "year" || type === "month" || type === "day",
      )
      .map(({ type, value }) => [type, value]),
  );
  return `${value.year}-${value.month}-${value.day}`;
}

export function clampCalendarDate(
  value: string,
  minimum: string,
  maximum?: string | null,
) {
  if (value < minimum) return minimum;
  if (maximum && value > maximum) return maximum;
  return value;
}
