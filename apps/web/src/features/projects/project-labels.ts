import type { ProjectStatus, ProjectType } from "@/lib/api/generated/models";

export const PROJECT_TYPE_LABELS = {
  written_submission: "Escrito (Demanda/Recurso/Escrito)",
  consultation: "Consulta (Correo/Informe)",
  oral_argument: "Informe oral",
  other: "Otro",
} satisfies Record<ProjectType, string>;

export const PROJECT_STATUS_LABELS = {
  draft: "Borrador",
  active: "Activo",
  completed: "Completado",
} satisfies Record<ProjectStatus, string>;
