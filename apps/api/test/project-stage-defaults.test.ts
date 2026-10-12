import { describe, expect, test } from "vitest";

import { getDefaultProjectStages } from "../src/projects/project-stage-defaults";

describe("project stage defaults", () => {
  test("defines the canonical Escrito structure", () => {
    expect(getDefaultProjectStages("written_submission")).toEqual([
      {
        name: "Investigación y análisis",
        description:
          "Revisión de antecedentes. Búsqueda de jurisprudencia y doctrina.",
      },
      { name: "Estrategia", description: "Elaboración de presentación." },
      {
        name: "Redacción",
        description: "Preparación de esquema. Elaboración de escrito.",
      },
      {
        name: "Revisión de socios",
        description: "Incorporación de ajustes de socios.",
      },
      {
        name: "Envío al cliente",
        description: "Trazar envío y seguimiento de conformidad.",
      },
      {
        name: "Presentación",
        description: "Presentar y enviar cargo al cliente.",
      },
    ]);
  });

  test("defines the canonical Consulta structure", () => {
    expect(getDefaultProjectStages("consultation")).toEqual([
      {
        name: "Investigación y análisis",
        description:
          "Revisión de antecedentes. Búsqueda de jurisprudencia y doctrina.",
      },
      { name: "Enfoque", description: "Definición de posición." },
      { name: "Redacción", description: "Elaboración de entregable." },
      {
        name: "Revisión de socios",
        description: "Incorporación de ajustes de socios.",
      },
      {
        name: "Envío al cliente",
        description: "Trazar envío y seguimiento de conformidad.",
      },
    ]);
  });

  test("defines the canonical Informe oral structure", () => {
    expect(getDefaultProjectStages("oral_argument")).toEqual([
      {
        name: "Acreditación",
        description: "Presentación de acreditación de abogados.",
      },
      {
        name: "Investigación y análisis",
        description:
          "Revisión de antecedentes. Búsqueda de jurisprudencia y doctrina.",
      },
      {
        name: "Presentación",
        description: "Elaboración de presentación. Ensayo interno.",
      },
      {
        name: "Informe oral",
        description: "Participación en informe oral.",
      },
      {
        name: "Alegatos",
        description:
          "Coordinación sobre enfoque de alegatos. Elaboración de escrito de alegatos.",
      },
      {
        name: "Salida",
        description: "Presentación de alegatos y enviar cargo al cliente.",
      },
    ]);
  });

  test("Otro has no predefined stages", () => {
    expect(getDefaultProjectStages("other")).toEqual([]);
  });
});
