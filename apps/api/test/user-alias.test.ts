import { describe, expect, test } from "vitest";

import {
  generateUserAlias,
  isValidUserAlias,
  normalizeUserAlias,
} from "../src/identity/user-alias";

describe("user alias", () => {
  test.each([
    ["Cristian Granda Pastora", "CGP"],
    ["María Fernanda De la Cruz", "MFDLC"],
    ["  Ana   María  ", "AM"],
    ["Cristian", "CRI"],
    ["Li", "LI"],
    ["Q", "QQ"],
    ["A B C D E F G H I J K L M N", "ABCDEFGHIJKL"],
    ["Ana-María Pérez", "AMP"],
    ["---9 vidas", "9V"],
    ["Élodie Dupont", "ÉD"],
    ["ß X", "SSX"],
    ["½", "ORBIT"],
    ["²", "ORBIT"],
    ["௰", "ORBIT"],
    ["!!!", "ORBIT"],
    ["", "ORBIT"],
    ["   ", "ORBIT"],
  ])("generates %s as %s", (name, alias) => {
    expect(generateUserAlias(name)).toBe(alias);
    expect(isValidUserAlias(generateUserAlias(name))).toBe(true);
  });

  test.each(["CGP", "Cris", "ÁG2", "ab"])("accepts %s", (alias) => {
    expect(isValidUserAlias(alias)).toBe(true);
  });

  test.each(["C", "ABCDEFGHIJKLM", "A B", "A-B", "🙂A", "  "])(
    "rejects %s",
    (alias) => expect(isValidUserAlias(alias)).toBe(false),
  );

  test("requires callers to normalize surrounding whitespace", () => {
    const normalized = normalizeUserAlias(" AB ");

    expect(normalized).toBe("AB");
    expect(isValidUserAlias(" AB ")).toBe(false);
    expect(isValidUserAlias(normalized)).toBe(true);
  });

  test("duplicates a one-code-point astral Unicode letter", () => {
    const alias = generateUserAlias("𐐀");

    expect(alias).toBe("𐐀𐐀");
    expect(isValidUserAlias(alias)).toBe(true);
  });

  test("caps generated aliases by Unicode code point", () => {
    const alias = generateUserAlias("𐐀 𐐁 𐐂 𐐃 𐐄 𐐅 𐐆 𐐇 𐐈 𐐉 𐐊 𐐋 𐐌");

    expect(Array.from(alias)).toHaveLength(12);
    expect(alias).toBe("𐐀𐐁𐐂𐐃𐐄𐐅𐐆𐐇𐐈𐐉𐐊𐐋");
    expect(isValidUserAlias(alias)).toBe(true);
  });
});
