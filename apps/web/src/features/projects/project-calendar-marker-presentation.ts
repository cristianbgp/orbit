import {
  CalendarCheck,
  CalendarDays,
  Flag,
  type LucideIcon,
} from "lucide-react";

import type { ProjectTaskCalendarMarkerKind } from "@/lib/api/generated/models";

type ProjectCalendarMarkerPresentation = {
  Icon: LucideIcon;
  iconTone: string;
  label: string;
  frameTone: string;
};

const presentations = {
  project_start: {
    Icon: Flag,
    iconTone: "text-amber-700",
    label: "Inicio del proyecto",
    frameTone: "border-amber-500 text-amber-700",
  },
  project_end: {
    Icon: CalendarCheck,
    iconTone: "text-danger",
    label: "Fin del proyecto",
    frameTone: "border-danger text-danger",
  },
  project_event: {
    Icon: CalendarDays,
    iconTone: "text-primary-strong",
    label: "Evento legal",
    frameTone: "border-primary text-primary-strong",
  },
} satisfies Record<
  ProjectTaskCalendarMarkerKind,
  ProjectCalendarMarkerPresentation
>;

export function projectCalendarMarkerPresentation(
  kind: ProjectTaskCalendarMarkerKind,
) {
  return presentations[kind];
}
