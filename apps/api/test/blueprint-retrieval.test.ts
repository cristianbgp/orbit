import { describe, expect, test } from "vitest";

import {
  blueprintDocuments,
  blueprintSections,
} from "../src/help-assistant/blueprint-corpus";
import { retrieveBlueprintSections } from "../src/help-assistant/blueprint-retrieval";

describe("Orbit help blueprint retrieval", () => {
  test("bundles the complete authoritative blueprint corpus", () => {
    expect(blueprintDocuments).toHaveLength(16);
    expect(blueprintDocuments.map(({ document }) => document)).toEqual([
      "README.md",
      "01-contexto-y-vision.md",
      "02-alcance-funcional.md",
      "03-arquitectura-informacion-ux.md",
      "04-modelo-dominio.md",
      "05-calendario-timeline.md",
      "06-ejemplo-recurso-apelacion.md",
      "07-sistema-visual.md",
      "08-branding-logo.md",
      "09-componentes-estados.md",
      "10-reglas-interaccion.md",
      "11-roadmap.md",
      "12-decisiones-y-pendientes.md",
      "13-prompt-maestro-codex.md",
      "14-inventario-funcional-implementado.md",
      "15-casos.md",
    ]);
    expect(
      blueprintDocuments.every(({ markdown }) => markdown.length > 100),
    ).toBe(true);
    expect(blueprintSections.some(({ heading }) => heading === "Project")).toBe(
      true,
    );
  });

  test("finds the same task deadline guidance with or without accents", () => {
    const accented = retrieveBlueprintSections(
      "¿Cómo funciona la fecha límite de una tarea?",
    );
    const plain = retrieveBlueprintSections(
      "como funciona la fecha limite de una tarea",
    );

    expect(accented.length).toBeGreaterThan(0);
    expect(plain.map(({ document, heading }) => [document, heading])).toEqual(
      accented.map(({ document, heading }) => [document, heading]),
    );
    expect(accented[0]?.content).toMatch(/internalDueDate|Fecha límite/i);
  });

  test("weights matching headings and returns stable unique sources", () => {
    const results = retrieveBlueprintSections(
      "¿Qué es un ProjectEvent y una fecha legal?",
    );

    expect(results[0]).toMatchObject({
      document: "04-modelo-dominio.md",
      heading: "ProjectEvent",
    });
    expect(results).toHaveLength(Math.min(results.length, 5));
    expect(
      new Set(results.map(({ document, heading }) => `${document}:${heading}`))
        .size,
    ).toBe(results.length);
  });

  test("does not manufacture evidence for an unrelated question", () => {
    expect(
      retrieveBlueprintSections(
        "¿Cuál es la receta tradicional de un tiramisú italiano?",
      ),
    ).toEqual([]);
  });
});
