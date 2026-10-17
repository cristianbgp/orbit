import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { AliasAvatar } from "@/features/identity/alias-avatar";
import {
  avatarColorPalette,
  accessibleAvatarForeground,
} from "@/features/identity/avatar-color-palette";

function relativeLuminance(hex: string) {
  const channels = hex
    .slice(1)
    .match(/../g)
    ?.map((channel) => Number.parseInt(channel, 16) / 255);

  if (!channels || channels.length !== 3) {
    throw new Error(`Expected a six-digit hex color, received ${hex}`);
  }

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

describe("AliasAvatar", () => {
  test("uses color pairs with WCAG AA contrast at its text sizes", () => {
    expect(avatarColorPalette).toHaveLength(10);

    for (const background of avatarColorPalette) {
      expect(
        contrastRatio(background, accessibleAvatarForeground(background)),
      ).toBeGreaterThanOrEqual(4.5);
    }
  });

  test("renders an approved stored background with its automatic accessible foreground", () => {
    render(
      <AliasAvatar
        userId="user-1"
        alias="CGP"
        fullName="Cristian Granda"
        avatarColor="#0f766e"
      />,
    );

    expect(screen.getByRole("img", { name: "Cristian Granda" })).toHaveStyle({
      backgroundColor: "#0f766e",
      color: accessibleAvatarForeground("#0f766e"),
    });
  });

  test("renders the localized uppercase first three alias characters with the full name label", () => {
    render(
      <AliasAvatar
        userId="user-1"
        alias="Cristian"
        fullName="Cristian Granda"
      />,
    );

    expect(screen.getByText("CRI")).toBeInTheDocument();
    expect(
      screen.getByRole("img", { name: "Cristian Granda" }),
    ).toBeInTheDocument();
  });

  test("caps aliases after Unicode uppercasing expands their code points", () => {
    render(<AliasAvatar userId="user-1" alias="ßß" fullName="Sharp S" />);

    const avatar = screen.getByRole("img", { name: "Sharp S" });
    expect(avatar).toHaveTextContent("SSS");
    expect(Array.from(avatar.textContent ?? "")).toHaveLength(3);
  });

  test("keeps its palette class stable when the alias changes", () => {
    const { rerender } = render(
      <AliasAvatar userId="user-1" alias="CGP" fullName="Cristian Granda" />,
    );
    const firstClass = screen.getByRole("img", {
      name: "Cristian Granda",
    }).className;

    rerender(
      <AliasAvatar userId="user-1" alias="XYZ" fullName="Cristian Granda" />,
    );

    expect(screen.getByRole("img", { name: "Cristian Granda" }).className).toBe(
      firstClass,
    );
  });

  test("ignores an unapproved stored color and keeps the deterministic fallback", () => {
    const { rerender } = render(
      <AliasAvatar userId="user-1" alias="AA" fullName="Palette" />,
    );
    const fallbackStyle = screen
      .getByRole("img", { name: "Palette" })
      .getAttribute("style");

    rerender(
      <AliasAvatar
        userId="user-1"
        alias="AA"
        fullName="Palette"
        avatarColor="#123456"
      />,
    );

    expect(screen.getByRole("img", { name: "Palette" })).toHaveAttribute(
      "style",
      fallbackStyle,
    );
  });
});
