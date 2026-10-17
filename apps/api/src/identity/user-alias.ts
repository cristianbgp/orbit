import {
  isUserAliasGeneratorCodePoint,
  toPinnedUserAliasUppercase,
} from "./user-alias-repertoire";

export const USER_ALIAS_MIN_LENGTH = 2;
export const USER_ALIAS_MAX_LENGTH = 12;
export const USER_ALIAS_PATTERN_SOURCE = "^[\\p{L}\\p{N}]+$";
export const DEFAULT_USER_ALIAS = "ORBIT";

const aliasCharacterPattern = new RegExp(
  USER_ALIAS_PATTERN_SOURCE.replace("+", ""),
  "u",
);

function hasValidAliasLength(characters: string[]) {
  return (
    characters.length >= USER_ALIAS_MIN_LENGTH &&
    characters.length <= USER_ALIAS_MAX_LENGTH
  );
}

function isPinnedGeneratedAlias(value: string) {
  const characters = Array.from(value);
  return (
    hasValidAliasLength(characters) &&
    characters.every((character) =>
      isUserAliasGeneratorCodePoint(character.codePointAt(0)!),
    )
  );
}

function getAliasParts(name: string) {
  const parts: string[] = [];
  let current = "";

  for (const character of name) {
    const codePoint = character.codePointAt(0)!;
    if (isUserAliasGeneratorCodePoint(codePoint)) {
      current += character;
    } else if (current) {
      parts.push(current);
      current = "";
    }
  }

  if (current) parts.push(current);
  return parts;
}

export function normalizeUserAlias(value: string) {
  return value.trim();
}

export function isValidUserAlias(value: string) {
  const characters = Array.from(value);
  return (
    hasValidAliasLength(characters) &&
    characters.every(
      (character) =>
        isUserAliasGeneratorCodePoint(character.codePointAt(0)!) ||
        aliasCharacterPattern.test(character),
    )
  );
}

export function generateUserAlias(name: string) {
  const words = getAliasParts(name);
  const raw =
    words.length > 1
      ? words.map((word) => Array.from(word)[0] ?? "").join("")
      : Array.from(words[0] ?? "")
          .slice(0, 3)
          .join("");
  const upper = Array.from(raw).map(toPinnedUserAliasUppercase).join("");
  const minimumSafe =
    Array.from(upper).length === 1 ? `${upper}${upper}` : upper;
  const candidate = Array.from(minimumSafe)
    .slice(0, USER_ALIAS_MAX_LENGTH)
    .join("");
  return isPinnedGeneratedAlias(candidate) ? candidate : DEFAULT_USER_ALIAS;
}

export function resolveUserAlias(
  storedAlias: string | null | undefined,
  displayName: string,
) {
  const normalized = normalizeUserAlias(storedAlias ?? "");
  return isValidUserAlias(normalized)
    ? normalized
    : generateUserAlias(displayName);
}
