import { cn } from "@/lib/utils";
import {
  accessibleAvatarForeground,
  avatarColorPalette,
  isApprovedAvatarColor,
} from "./avatar-color-palette";

const legacyAvatarColors = avatarColorPalette.slice(0, 4);

const avatarSizeClasses = {
  xs: "size-5 text-[0.5rem]",
  sm: "size-7 text-[0.625rem]",
  md: "size-9 text-xs",
  lg: "size-11 text-sm",
} as const;

type AliasAvatarSize = keyof typeof avatarSizeClasses;

function getAvatarColorPair(userId: string) {
  let hash = 0;

  for (let index = 0; index < userId.length; index += 1) {
    hash = (hash * 31 + userId.charCodeAt(index)) >>> 0;
  }

  return legacyAvatarColors[hash % legacyAvatarColors.length]!;
}

export function AliasAvatar({
  userId,
  alias,
  fullName,
  avatarColor,
  size = "md",
}: {
  userId: string;
  alias: string;
  fullName: string;
  avatarColor?: string | null;
  size?: AliasAvatarSize;
}) {
  const initials = Array.from(alias.toLocaleUpperCase("es-PE"))
    .slice(0, 3)
    .join("");
  const fallbackColor = getAvatarColorPair(userId);
  const background = isApprovedAvatarColor(avatarColor)
    ? avatarColor!.trim().toLowerCase()
    : fallbackColor;
  const foreground = accessibleAvatarForeground(background);

  return (
    <span
      role="img"
      aria-label={fullName}
      style={{
        backgroundColor: background,
        color: foreground,
      }}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full leading-none font-semibold",
        avatarSizeClasses[size],
      )}
    >
      {initials}
    </span>
  );
}
