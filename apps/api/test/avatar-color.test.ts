import { describe, expect, test } from "vitest";

import {
  AVATAR_COLORS,
  LEGACY_AVATAR_COLORS,
  avatarColorForUserId,
  isValidAvatarColor,
  normalizeAvatarColor,
} from "../src/identity/avatar-color";

describe("avatar color palette", () => {
  test("defines ten unique normalized hexadecimal backgrounds", () => {
    expect(AVATAR_COLORS).toHaveLength(10);
    expect(new Set(AVATAR_COLORS)).toHaveLength(10);
    AVATAR_COLORS.forEach((color) => expect(color).toMatch(/^#[0-9a-f]{6}$/));
  });

  test("keeps the original deterministic assignment for existing users", () => {
    expect(avatarColorForUserId("user-1", LEGACY_AVATAR_COLORS)).toBe(
      "#11182b",
    );
    expect(avatarColorForUserId("user-1")).toBe(AVATAR_COLORS[1]);
  });

  test("normalizes palette values and rejects arbitrary hexadecimal colors", () => {
    expect(normalizeAvatarColor(" #4657D9 ")).toBe("#4657d9");
    expect(isValidAvatarColor("#4657d9")).toBe(true);
    expect(isValidAvatarColor("#ffffff")).toBe(false);
    expect(isValidAvatarColor("blue")).toBe(false);
  });
});
