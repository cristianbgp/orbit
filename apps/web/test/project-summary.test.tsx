import { render, screen, within } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { ProjectSummary } from "@/features/projects/project-summary";

const project = {
  id: "project-1",
  client: { id: "client-1", name: "Constructora del Sur S.A." },
  name: "Apelación Constructora",
  type: "written_submission" as const,
  status: "draft" as const,
  startDate: "2026-08-06",
  endDate: "2026-08-17",
  internalReference: "EXP-2026-014",
  description: "Impugnación de la resolución de primera instancia.",
  archivedAt: null,
  createdAt: "2026-08-05T10:00:00.000Z",
  updatedAt: "2026-08-05T10:00:00.000Z",
};

describe("ProjectSummary", () => {
  test("presents project identity and dates as one command header", () => {
    render(<ProjectSummary project={project} />);

    const header = screen.getByRole("region", {
      name: "Resumen del proyecto",
    });
    expect(
      within(header).getByRole("heading", { name: project.name }),
    ).toBeInTheDocument();
    expect(within(header).getAllByRole("heading", { level: 1 })).toHaveLength(
      1,
    );
    expect(header.querySelector("svg.lucide-folder-kanban")).toHaveAttribute(
      "aria-hidden",
      "true",
    );
    expect(
      header.querySelector('[data-slot="app-page-header-icon"]'),
    ).toHaveClass("size-11", "bg-primary-soft", "text-primary-strong");
    expect(within(header).getByText(project.client.name)).toBeInTheDocument();
    expect(within(header).getByText("Inicio")).toBeInTheDocument();
    expect(within(header).getByText("Final")).toBeInTheDocument();
  });

  test("renders the persistent legal project context", () => {
    render(<ProjectSummary project={project} />);

    expect(
      screen.getByRole("heading", { name: "Apelación Constructora" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Constructora del Sur S.A.")).toBeInTheDocument();
    expect(
      screen.getByText("Escrito (Demanda/Recurso/Escrito)"),
    ).toBeInTheDocument();
    expect(screen.getByText("Borrador")).toBeInTheDocument();
    expect(screen.getByText(/EXP-2026-014/)).toBeInTheDocument();
    expect(
      screen.getByText("Impugnación de la resolución de primera instancia."),
    ).toBeInTheDocument();
  });

  test("renders the project start and end dates", () => {
    render(<ProjectSummary project={project} />);

    expect(screen.getByText("6 ago 2026")).toBeInTheDocument();
    expect(screen.getByText("17 ago 2026")).toBeInTheDocument();
    expect(screen.getByText("Final")).toBeInTheDocument();
  });

  test("omits absent optional context without reserving placeholder content", () => {
    render(
      <ProjectSummary
        project={{ ...project, description: null, internalReference: null }}
      />,
    );

    expect(screen.queryByText("Sin descripción")).not.toBeInTheDocument();
    expect(screen.queryByText("Resumen")).not.toBeInTheDocument();
    expect(screen.getByText(project.client.name)).toBeInTheDocument();
    expect(screen.getByText("6 ago 2026")).toBeInTheDocument();
    expect(screen.getByText("17 ago 2026")).toBeInTheDocument();
    expect(
      screen.queryByText("Planificación del proyecto"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText(/riesgo|progreso|supervisor|actividad/i),
    ).not.toBeInTheDocument();
  });

  test("keeps the lifecycle status and marks an archived project", () => {
    render(
      <ProjectSummary
        project={{ ...project, archivedAt: "2026-08-10T15:00:00.000Z" }}
      />,
    );

    expect(screen.getByText("Borrador")).toBeInTheDocument();
    expect(screen.getByText("Archivado")).toBeInTheDocument();
  });
});
