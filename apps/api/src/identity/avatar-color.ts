export const LEGACY_AVATAR_COLORS = [
  "#4657d9",
  "#4057ed",
  "#07162f",
  "#11182b",
] as const;

export const AVATAR_COLORS = [
  ...LEGACY_AVATAR_COLORS,
  "#0f766e",
  "#047857",
  "#7e3a8a",
  "#9f3151",
  "#a43f27",
  "#8a5a00",
] as const;

export type AvatarColor = (typeof AVATAR_COLORS)[number];

export function normalizeAvatarColor(value: string) {
  return value.trim().toLowerCase();
}

export function isValidAvatarColor(value: string): value is AvatarColor {
  return AVATAR_COLORS.includes(value as AvatarColor);
}

export function avatarColorForUserId(
  userId: string,
  palette: readonly string[] = AVATAR_COLORS,
) {
  let hash = 0;
  for (let index = 0; index < userId.length; index += 1) {
    hash = (hash * 31 + userId.charCodeAt(index)) >>> 0;
  }
  return palette[hash % palette.length]!;
}
