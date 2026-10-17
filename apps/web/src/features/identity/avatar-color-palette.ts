export const avatarColorOptions = [
  { value: "#4657d9", label: "Índigo" },
  { value: "#4057ed", label: "Azul Orbit" },
  { value: "#07162f", label: "Azul noche" },
  { value: "#11182b", label: "Grafito" },
  { value: "#0f766e", label: "Verde azulado" },
  { value: "#047857", label: "Verde" },
  { value: "#7e3a8a", label: "Violeta" },
  { value: "#9f3151", label: "Frambuesa" },
  { value: "#a43f27", label: "Terracota" },
  { value: "#8a5a00", label: "Ocre" },
] as const;

export const avatarColorPalette = avatarColorOptions.map(({ value }) => value);

const avatarForegrounds = ["#ffffff", "#11182b"] as const;

function relativeLuminance(hex: string) {
  const channels = hex
    .slice(1)
    .match(/../g)
    ?.map((channel) => Number.parseInt(channel, 16) / 255);

  if (!channels || channels.length !== 3) return 0;

  const [red, green, blue] = channels.map((channel) =>
    channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4,
  );
  return red * 0.2126 + green * 0.7152 + blue * 0.0722;
}

function contrastRatio(first: string, second: string) {
  const [lighter, darker] = [
    relativeLuminance(first),
    relativeLuminance(second),
  ].sort((left, right) => right - left);
  return (lighter + 0.05) / (darker + 0.05);
}

export function isApprovedAvatarColor(value: string | null | undefined) {
  return avatarColorPalette.includes(
    value?.trim().toLowerCase() as (typeof avatarColorPalette)[number],
  );
}

export function accessibleAvatarForeground(background: string) {
  return avatarForegrounds.reduce((best, candidate) =>
    contrastRatio(background, candidate) > contrastRatio(background, best)
      ? candidate
      : best,
  );
}
