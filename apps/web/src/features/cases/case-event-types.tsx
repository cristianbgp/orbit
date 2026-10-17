import { CalendarDays, MessageSquareText, MicVocal } from "lucide-react";

export type CaseEventType = "oral_argument" | "interview" | "other";

export const CASE_EVENT_TYPE_OPTIONS = [
  {
    value: "oral_argument" as const,
    label: "Informe oral",
    suggestedTitle: "Informe oral",
    icon: MicVocal,
  },
  {
    value: "interview" as const,
    label: "Entrevista",
    suggestedTitle: "Entrevista",
    icon: MessageSquareText,
  },
  {
    value: "other" as const,
    label: "Otro",
    suggestedTitle: "Otro evento",
    icon: CalendarDays,
  },
] satisfies Array<{
  value: CaseEventType;
  label: string;
  suggestedTitle: string;
  icon: typeof MicVocal;
}>;

export function getCaseEventTypePresentation(type: string) {
  return (
    CASE_EVENT_TYPE_OPTIONS.find((option) => option.value === type) ??
    CASE_EVENT_TYPE_OPTIONS[2]
  );
}

export function CaseEventTypeIcon({
  type,
  className,
}: {
  type: string;
  className?: string;
}) {
  const Icon = getCaseEventTypePresentation(type).icon;
  return <Icon aria-hidden="true" className={className} />;
}
