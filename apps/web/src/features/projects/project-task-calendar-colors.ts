export const PROJECT_TASK_CALENDAR_TONES = [
  {
    dot: "bg-indigo-600",
    bar: "bg-indigo-50",
    border: "border-indigo-200",
    text: "text-indigo-700",
    auditBackground: "#eef2ff",
    auditForeground: "#4338ca",
  },
  {
    dot: "bg-emerald-600",
    bar: "bg-emerald-50",
    border: "border-emerald-200",
    text: "text-emerald-700",
    auditBackground: "#ecfdf5",
    auditForeground: "#047857",
  },
  {
    dot: "bg-sky-600",
    bar: "bg-sky-50",
    border: "border-sky-200",
    text: "text-sky-700",
    auditBackground: "#f0f9ff",
    auditForeground: "#0369a1",
  },
  {
    dot: "bg-violet-600",
    bar: "bg-violet-50",
    border: "border-violet-200",
    text: "text-violet-700",
    auditBackground: "#f5f3ff",
    auditForeground: "#6d28d9",
  },
  {
    dot: "bg-fuchsia-600",
    bar: "bg-fuchsia-50",
    border: "border-fuchsia-200",
    text: "text-fuchsia-700",
    auditBackground: "#fdf4ff",
    auditForeground: "#a21caf",
  },
  {
    dot: "bg-slate-500",
    bar: "bg-slate-100",
    border: "border-slate-200",
    text: "text-slate-800",
    auditBackground: "#f1f5f9",
    auditForeground: "#1e293b",
  },
] as const;

export function projectTaskCalendarTone(
  projectId: string,
  _displayName?: string,
) {
  let hash = 0;

  for (let index = 0; index < projectId.length; index += 1) {
    hash = (hash * 31 + projectId.charCodeAt(index)) >>> 0;
  }

  return PROJECT_TASK_CALENDAR_TONES[hash % PROJECT_TASK_CALENDAR_TONES.length];
}
