import type { BlueprintSection } from "./help-assistant-types";
import { generatedBlueprintDocuments } from "./blueprint-documents.generated";

export const blueprintDocuments = generatedBlueprintDocuments;

export function normalizeHelpText(value: string) {
  return value
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLocaleLowerCase("es")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function parseDocument(document: string, markdown: string): BlueprintSection[] {
  const lines = markdown.split(/\r?\n/);
  const sections: BlueprintSection[] = [];
  let heading = document.replace(/\.md$/, "");
  let body: string[] = [];

  function flush() {
    const content = body.join("\n").trim();
    if (!content) return;
    const terms = normalizeHelpText(`${heading} ${content}`)
      .split(" ")
      .filter(Boolean);
    sections.push({
      document,
      heading,
      content,
      normalizedTerms: [...new Set(terms)],
    });
  }

  for (const line of lines) {
    const match = /^(#{1,6})\s+(.+?)\s*$/.exec(line);
    if (!match) {
      body.push(line);
      continue;
    }
    flush();
    heading = match[2]!.replace(/[*_`]/g, "").trim();
    body = [];
  }
  flush();
  return sections;
}

export const blueprintSections = blueprintDocuments.flatMap(
  ({ document, markdown }) => parseDocument(document, markdown),
);
