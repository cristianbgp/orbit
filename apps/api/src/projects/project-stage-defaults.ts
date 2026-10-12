import type { ProjectType } from "./project-types";

export type ProjectStageDefault = Readonly<{
  name: string;
  description: string;
}>;

const DEFAULT_PROJECT_STAGES: Readonly<
  Record<ProjectType, readonly ProjectStageDefault[]>
> = {
  written_submission: [
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
  ],
  consultation: [
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
  ],
  oral_argument: [
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
  ],
  other: [],
};

export function getDefaultProjectStages(type: ProjectType) {
  return DEFAULT_PROJECT_STAGES[type];
}
