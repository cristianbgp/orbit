import { blueprintSections, normalizeHelpText } from "./blueprint-corpus";
import type { BlueprintSection } from "./help-assistant-types";

const STOP_WORDS = new Set([
  "a",
  "al",
  "algo",
  "como",
  "con",
  "cual",
  "de",
  "del",
  "el",
  "en",
  "es",
  "esta",
  "funciona",
  "la",
  "las",
  "lo",
  "los",
  "o",
  "para",
  "por",
  "que",
  "se",
  "su",
  "una",
  "un",
  "y",
]);

function queryTerms(question: string) {
  return normalizeHelpText(question)
    .split(" ")
    .filter((term) => term.length > 1 && !STOP_WORDS.has(term));
}

function scoreSection(
  section: BlueprintSection,
  terms: string[],
  phrase: string,
) {
  const heading = normalizeHelpText(section.heading);
  const document = normalizeHelpText(
    section.document.replace(/\d{2}-/, "").replace(/\.md$/, ""),
  );
  const content = normalizeHelpText(section.content);
  let score = 0;

  if (phrase.length >= 8 && content.includes(phrase)) score += 10;
  for (const term of terms) {
    if (heading.split(" ").includes(term)) score += 8;
    else if (heading.includes(term)) score += 5;
    if (document.includes(term)) score += 3;
    if (section.normalizedTerms.includes(term)) score += 1;
  }
  if (terms.length > 1 && terms.every((term) => content.includes(term)))
    score += 4;
  return score;
}

export function retrieveBlueprintSections(question: string, limit = 5) {
  const phrase = normalizeHelpText(question);
  const terms = queryTerms(question);
  if (terms.length === 0) return [];

  return blueprintSections
    .map((section, index) => ({
      section,
      index,
      score: scoreSection(section, terms, phrase),
    }))
    .filter(({ score }) => score >= 4)
    .sort((left, right) => right.score - left.score || left.index - right.index)
    .slice(0, Math.max(0, Math.min(limit, 5)))
    .map(({ section }) => section);
}
