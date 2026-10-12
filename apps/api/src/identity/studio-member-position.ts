export const STUDIO_MEMBER_POSITIONS = [
  "partner",
  "senior",
  "junior",
  "assistant",
  "intern",
] as const;

export type StudioMemberPosition = (typeof STUDIO_MEMBER_POSITIONS)[number];

export const STUDIO_MEMBER_POSITION_LABELS: Record<
  StudioMemberPosition,
  string
> = {
  partner: "Socio",
  senior: "Senior",
  junior: "Junior",
  assistant: "Asistente",
  intern: "Practicante",
};

export function isStudioMemberPosition(
  value: unknown,
): value is StudioMemberPosition {
  return (
    typeof value === "string" &&
    STUDIO_MEMBER_POSITIONS.some((position) => position === value)
  );
}
