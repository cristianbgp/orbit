import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, test, vi } from "vitest";

import { CaseEventSheet } from "./case-event-sheet";

Element.prototype.scrollIntoView = vi.fn();

vi.mock("@/components/ui/calendar-date-picker", () => ({
  DatePicker: ({
    label,
    value,
    onChange,
    error,
  }: {
    label: string;
    value: string;
    onChange(value: string): void;
    error?: string;
  }) => (
    <label>
      {label}
      <input
        aria-label={label}
        aria-invalid={Boolean(error)}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
      {error ? <span role="alert">{error}</span> : null}
    </label>
  ),
}));

describe("CaseEventSheet", () => {
  test("selects an event type, suggests its title, and submits it with case context", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(
      <MemoryRouter>
        <CaseEventSheet
          open
          event={null}
          busy={false}
          error={null}
          caseContext={{
            caseId: "case-1",
            caseName: "Proceso tributario",
            clientName: "Cliente Uno",
          }}
          onOpenChange={vi.fn()}
          onSubmit={onSubmit}
        />
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { name: "Nuevo evento" })).toBeVisible();
    expect(screen.getByLabelText("Título")).toHaveValue("Informe oral");
    fireEvent.click(screen.getByRole("combobox", { name: "Tipo" }));
    fireEvent.click(screen.getByRole("option", { name: "Entrevista" }));
    expect(screen.getByLabelText("Título")).toHaveValue("Entrevista");
    expect(
      screen.getByRole("link", { name: "Proceso tributario" }),
    ).toHaveAttribute("href", "/cases/case-1");
    fireEvent.change(screen.getByLabelText("Título"), {
      target: { value: "  Entrevista con especialista  " },
    });
    fireEvent.change(screen.getByLabelText("Fecha"), {
      target: { value: "2026-09-18" },
    });
    fireEvent.change(screen.getByLabelText(/Descripción/), {
      target: { value: "   " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Guardar evento" }));

    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith({
        title: "Entrevista con especialista",
        type: "interview",
        date: "2026-09-18",
        description: null,
      }),
    );
  });

  test("prefills editing and still validates a cleared title and missing date", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const onDelete = vi.fn();
    const { rerender } = render(
      <MemoryRouter>
        <CaseEventSheet
          open
          event={null}
          busy={false}
          error={null}
          onOpenChange={vi.fn()}
          onSubmit={onSubmit}
        />
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByLabelText("Título"), {
      target: { value: "" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Guardar evento" }));
    expect(
      screen.getByText("Ingresa un título de al menos 2 caracteres."),
    ).toBeVisible();
    expect(screen.getByText("Selecciona una fecha.")).toBeVisible();
    expect(onSubmit).not.toHaveBeenCalled();

    rerender(
      <MemoryRouter>
        <CaseEventSheet
          open
          event={{
            id: "event-1",
            title: "Vista de la causa",
            type: "oral_argument",
            date: "2026-09-20",
            description: "Sala especializada",
            createdByUserId: "user-1",
            createdAt: "2026-09-03T10:00:00.000Z",
            updatedAt: "2026-09-03T10:00:00.000Z",
          }}
          busy={false}
          error={null}
          onOpenChange={vi.fn()}
          onSubmit={onSubmit}
          onDelete={onDelete}
        />
      </MemoryRouter>,
    );

    expect(
      screen.getByRole("heading", { name: "Editar evento" }),
    ).toBeVisible();
    expect(screen.getByLabelText("Título")).toHaveValue("Vista de la causa");
    expect(screen.getByLabelText("Fecha")).toHaveValue("2026-09-20");
    expect(screen.getByLabelText(/Descripción/)).toHaveValue(
      "Sala especializada",
    );
    fireEvent.click(screen.getByRole("button", { name: "Eliminar evento" }));
    expect(onDelete).toHaveBeenCalledOnce();
  });

  test("marks only the missing date when a valid title was entered", () => {
    render(
      <MemoryRouter>
        <CaseEventSheet
          open
          event={null}
          busy={false}
          error={null}
          onOpenChange={vi.fn()}
          onSubmit={vi.fn()}
        />
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByLabelText("Título"), {
      target: { value: "Informe oral" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Guardar evento" }));

    expect(screen.getByLabelText("Título")).toHaveAttribute(
      "aria-invalid",
      "false",
    );
    expect(screen.getByLabelText("Fecha")).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Selecciona una fecha.",
    );
  });
});
