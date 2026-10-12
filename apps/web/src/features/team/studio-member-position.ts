export const STUDIO_MEMBER_POSITION_OPTIONS = [
  { value: "partner", label: "Socio" },
  { value: "senior", label: "Senior" },
  { value: "junior", label: "Junior" },
  { value: "assistant", label: "Asistente" },
  { value: "intern", label: "Practicante" },
] as const;

export type StudioMemberPositionValue =
  (typeof STUDIO_MEMBER_POSITION_OPTIONS)[number]["value"];

export const STUDIO_MEMBER_POSITION_GROUPS = [
  ...STUDIO_MEMBER_POSITION_OPTIONS,
  { value: null, label: "Sin posición" },
] as const;

export function studioMemberPositionLabel(
  value: string | null | undefined,
): string {
  return (
    STUDIO_MEMBER_POSITION_OPTIONS.find((option) => option.value === value)
      ?.label ?? "Sin posición"
  );
}

export function groupStudioMembersByPosition<T>(
  members: readonly T[],
  getPosition: (member: T) => string | null | undefined,
) {
  return STUDIO_MEMBER_POSITION_GROUPS.flatMap((position) => {
    const positionMembers = members.filter((member) => {
      const memberPosition = getPosition(member);
      if (position.value !== null) return memberPosition === position.value;
      return !STUDIO_MEMBER_POSITION_OPTIONS.some(
        (option) => option.value === memberPosition,
      );
    });
    return positionMembers.length
      ? [{ ...position, members: positionMembers }]
      : [];
  });
}
