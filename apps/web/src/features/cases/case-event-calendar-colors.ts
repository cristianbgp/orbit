export const CASE_EVENT_CALENDAR_TONES = [
  {
    dot: "bg-indigo-600",
    surface: "bg-indigo-50",
    border: "border-indigo-200",
    text: "text-indigo-700",
  },
  {
    dot: "bg-emerald-600",
    surface: "bg-emerald-50",
    border: "border-emerald-200",
    text: "text-emerald-700",
  },
  {
    dot: "bg-sky-600",
    surface: "bg-sky-50",
    border: "border-sky-200",
    text: "text-sky-700",
  },
  {
    dot: "bg-violet-600",
    surface: "bg-violet-50",
    border: "border-violet-200",
    text: "text-violet-700",
  },
  {
    dot: "bg-fuchsia-600",
    surface: "bg-fuchsia-50",
    border: "border-fuchsia-200",
    text: "text-fuchsia-700",
  },
  {
    dot: "bg-slate-500",
    surface: "bg-slate-100",
    border: "border-slate-200",
    text: "text-slate-800",
  },
] as const;

export function caseEventCalendarTone(caseId: string) {
  let hash = 0;
  for (let index = 0; index < caseId.length; index += 1) {
    hash = (hash * 31 + caseId.charCodeAt(index)) >>> 0;
  }
  return CASE_EVENT_CALENDAR_TONES[hash % CASE_EVENT_CALENDAR_TONES.length]!;
}
