import {
  fireEvent,
  render as testingLibraryRender,
  screen,
  waitFor,
} from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, test, vi } from "vitest";

import { CalendarTodayProvider } from "@/components/ui/calendar-today-context";
import { ProjectForm } from "@/features/projects/project-form";

Element.prototype.scrollIntoView = vi.fn();

function render(ui: ReactNode) {
  return testingLibraryRender(
    <CalendarTodayProvider today="2026-08-01">{ui}</CalendarTodayProvider>,
  );
}

function chooseOption(label: string, option: string) {
  fireEvent.click(screen.getByRole("combobox", { name: label }));
  fireEvent.click(screen.getByRole("option", { name: option }));
}

vi.mock("@/features/projects/client-selector", () => ({
  ClientSelector: ({
    value,
    onChange,
    error,
  }: {
    value: { id: string; name: string } | null;
    onChange(value: { id: string; name: string }): void;
    error?: string;
  }) => (
    <div>
      <button
        type="button"
        onClick={() =>
          onChange({
            id: "client-1",
            name: "Construcciones del Sur S.A.",
          })
        }
      >
        Elegir cliente
      </button>
      {value ? <span>{value.name}</span> : null}
      {error ? <span role="alert">{error}</span> : null}
    </div>
  ),
}));

vi.mock("@/features/projects/project-initial-team-selector", () => ({
  ProjectInitialTeamSelector: ({
    value,
    onChange,
  }: {
    value: Array<{ member: { userId: string }; responsibility: string }>;
    onChange(value: unknown[]): void;
  }) => (
    <div>
      <button
        type="button"
        onClick={() =>
          onChange([
            {
              member: {
                userId: "user-2",
                name: "Luis Ramos",
                email: "luis@orbit.pe",
                alias: "LR",
                avatarColor: "#11182b",
              },
              responsibility: "responsible",
            },
          ])
        }
      >
        Añadir supervisor de prueba
      </button>
      <span>{value.length} seleccionados</span>
    </div>
  ),
}));

const project = {
  id: "project-1",
  client: { id: "client-1", name: "Construcciones del Sur S.A." },
  name: "Recurso de apelación",
  type: "written_submission" as const,
  status: "active" as const,
  startDate: "2026-08-06",
  endDate: "2026-08-17",
  internalReference: "APE-026",
  description: "Preparar el recurso.",
  archivedAt: null,
  createdAt: "2026-08-06T10:00:00.000Z",
  updatedAt: "2026-08-06T10:00:00.000Z",
};

function fillValidForm() {
  fireEvent.change(screen.getByLabelText("Nombre del proyecto"), {
    target: { value: "Recurso de apelación" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Elegir cliente" }));
  chooseOption("Tipo de proyecto", "Escrito (Demanda/Recurso/Escrito)");
  fireEvent.click(screen.getByLabelText("Periodo del proyecto"));
  fireEvent.click(
    screen.getByRole("button", {
      name: /^jueves, 6 de agosto de 2026$/i,
    }),
  );
  fireEvent.click(
    screen.getByRole("button", {
      name: /^lunes, 17 de agosto de 2026$/i,
    }),
  );
}

describe("ProjectForm", () => {
  test("omits the cancel action when the surrounding page has nothing to close", () => {
    render(<ProjectForm onSubmit={vi.fn()} />);

    expect(screen.queryByRole("button", { name: "Cancelar" })).toBeNull();
    expect(
      screen.getByRole("button", { name: "Crear proyecto" }),
    ).toBeInTheDocument();
  });

  test("starts new projects with empty dates and draft status", () => {
    render(<ProjectForm onSubmit={vi.fn()} onCancel={vi.fn()} />);

    expect(screen.getByLabelText("Periodo del proyecto")).toHaveTextContent(
      "Selecciona un periodo",
    );
    expect(screen.getByLabelText("Estado")).toHaveTextContent("Borrador");
    expect(screen.getByLabelText("Tipo de proyecto")).toHaveTextContent(
      "Selecciona un tipo",
    );
  });

  test("offers the new project types with Spanish labels", () => {
    render(<ProjectForm onSubmit={vi.fn()} onCancel={vi.fn()} />);

    fireEvent.click(screen.getByRole("combobox", { name: "Tipo de proyecto" }));

    expect(
      screen.getByRole("option", {
        name: "Escrito (Demanda/Recurso/Escrito)",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("option", { name: "Consulta (Correo/Informe)" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("option", { name: "Informe oral" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Otro" })).toBeInTheDocument();
    expect(
      screen.queryByRole("option", { name: "Recurso de apelación" }),
    ).toBeNull();
  });

  test("submits required values and omits blank optional fields", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<ProjectForm onSubmit={onSubmit} onCancel={vi.fn()} />);
    fillValidForm();

    fireEvent.click(screen.getByRole("button", { name: "Crear proyecto" }));

    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith({
        name: "Recurso de apelación",
        clientId: "client-1",
        type: "written_submission",
        status: "draft",
        startDate: "2026-08-06",
        endDate: "2026-08-17",
      }),
    );
  });

  test("optionally creates multiple customized legal events independently of the project end", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<ProjectForm onSubmit={onSubmit} onCancel={vi.fn()} />);
    fillValidForm();

    fireEvent.change(screen.getByLabelText("Nombre del evento legal 1"), {
      target: { value: "Audiencia ante la Sala" },
    });
    fireEvent.change(screen.getByLabelText("Descripción del evento legal 1"), {
      target: { value: "Sustentación del recurso." },
    });
    fireEvent.click(screen.getByLabelText("Fecha legal 1"));
    fireEvent.click(
      screen.getByRole("button", { name: /20 de agosto de 2026/i }),
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Añadir otra fecha legal" }),
    );
    expect(screen.getByLabelText("Nombre del evento legal 2")).toHaveFocus();
    fireEvent.change(screen.getByLabelText("Nombre del evento legal 2"), {
      target: { value: "Presentación del escrito" },
    });
    fireEvent.click(screen.getByLabelText("Fecha legal 2"));
    fireEvent.click(
      screen.getByRole("button", { name: /24 de agosto de 2026/i }),
    );

    fireEvent.click(screen.getByRole("button", { name: "Crear proyecto" }));

    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          startDate: "2026-08-06",
          endDate: "2026-08-17",
          initialLegalEvents: [
            {
              title: "Audiencia ante la Sala",
              date: "2026-08-20",
              description: "Sustentación del recurso.",
            },
            {
              title: "Presentación del escrito",
              date: "2026-08-24",
            },
          ],
        }),
      ),
    );
  });

  test("removes an additional legal event and keeps one editable row", () => {
    render(<ProjectForm onSubmit={vi.fn()} onCancel={vi.fn()} />);

    fireEvent.click(
      screen.getByRole("button", { name: "Añadir otra fecha legal" }),
    );
    fireEvent.change(screen.getByLabelText("Nombre del evento legal 2"), {
      target: { value: "Audiencia" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Eliminar fecha legal 2" }),
    );

    expect(
      screen.queryByLabelText("Nombre del evento legal 2"),
    ).not.toBeInTheDocument();
    expect(screen.getByLabelText("Nombre del evento legal 1")).toHaveValue(
      "Fecha legal",
    );
  });

  test("requires a legal event name when its date is selected", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<ProjectForm onSubmit={onSubmit} onCancel={vi.fn()} />);
    fillValidForm();

    fireEvent.change(screen.getByLabelText("Nombre del evento legal 1"), {
      target: { value: " " },
    });
    fireEvent.click(screen.getByLabelText("Fecha legal 1"));
    fireEvent.click(
      screen.getByRole("button", { name: /20 de agosto de 2026/i }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Crear proyecto" }));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(
      screen.getByText("Ingresa un nombre para el evento legal."),
    ).toBeInTheDocument();
  });

  test("requires a date for a partially completed legal event", () => {
    const onSubmit = vi.fn();
    render(<ProjectForm onSubmit={onSubmit} onCancel={vi.fn()} />);
    fillValidForm();
    fireEvent.change(screen.getByLabelText("Nombre del evento legal 1"), {
      target: { value: "Audiencia" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Crear proyecto" }));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(
      screen.getByText("Selecciona una fecha para el evento legal."),
    ).toBeInTheDocument();
  });

  test("optionally submits initial project members and supervisors", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<ProjectForm onSubmit={onSubmit} onCancel={vi.fn()} />);
    fillValidForm();
    fireEvent.click(
      screen.getByRole("button", { name: "Añadir supervisor de prueba" }),
    );

    fireEvent.click(screen.getByRole("button", { name: "Crear proyecto" }));

    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          initialAssignments: [
            { userId: "user-2", responsibility: "responsible" },
          ],
        }),
      ),
    );
  });

  test("focuses the first missing required field", () => {
    render(<ProjectForm onSubmit={vi.fn()} onCancel={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Crear proyecto" }));

    expect(screen.getByLabelText("Nombre del proyecto")).toHaveFocus();
    expect(
      screen.getByText("Ingresa el nombre del proyecto."),
    ).toBeInTheDocument();
  });

  test("names a missing final date clearly", () => {
    render(<ProjectForm onSubmit={vi.fn()} onCancel={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("Nombre del proyecto"), {
      target: { value: "Recurso de apelación" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Elegir cliente" }));
    chooseOption("Tipo de proyecto", "Escrito (Demanda/Recurso/Escrito)");
    fireEvent.click(screen.getByLabelText("Periodo del proyecto"));
    fireEvent.click(
      screen.getByRole("button", {
        name: /^jueves, 6 de agosto de 2026$/i,
      }),
    );

    fireEvent.click(screen.getByRole("button", { name: "Crear proyecto" }));

    expect(screen.getByText("Selecciona la fecha final.")).toBeInTheDocument();
  });

  test("rejects a final date before the start date", () => {
    const onSubmit = vi.fn();
    render(
      <ProjectForm
        initialProject={{
          ...project,
          startDate: "2026-08-15",
          endDate: "2026-08-14",
        }}
        onSubmit={onSubmit}
        onCancel={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(
      screen.getByText(
        "La fecha final no puede ser anterior a la fecha de inicio.",
      ),
    ).toBeInTheDocument();
  });

  test("does not show the creation-only legal event field while editing", () => {
    render(
      <ProjectForm
        initialProject={project}
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    expect(screen.queryByLabelText("Fecha legal 1")).not.toBeInTheDocument();
    expect(
      screen.queryByLabelText("Nombre del evento legal 1"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByLabelText("Descripción del evento legal 1"),
    ).not.toBeInTheDocument();
  });

  test("retains values after a failed save", async () => {
    const onSubmit = vi.fn().mockRejectedValue(new Error("network"));
    render(<ProjectForm onSubmit={onSubmit} onCancel={vi.fn()} />);
    fillValidForm();

    fireEvent.click(screen.getByRole("button", { name: "Crear proyecto" }));

    expect(
      await screen.findByText(
        "No pudimos guardar el proyecto. Inténtalo nuevamente.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Nombre del proyecto")).toHaveValue(
      "Recurso de apelación",
    );
  });

  test("initializes edit mode and submits optional values", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(
      <ProjectForm
        initialProject={project}
        onSubmit={onSubmit}
        onCancel={vi.fn()}
      />,
    );

    expect(screen.getByLabelText("Estado")).toHaveTextContent("Activo");
    expect(screen.getByText("Construcciones del Sur S.A.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));

    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith({
        name: "Recurso de apelación",
        clientId: "client-1",
        type: "written_submission",
        status: "active",
        startDate: "2026-08-06",
        endDate: "2026-08-17",
        internalReference: "APE-026",
        description: "Preparar el recurso.",
      }),
    );
  });
});
