import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";

import { ClientForm } from "@/features/clients/client-form";

Element.prototype.scrollIntoView = vi.fn();

describe("ClientForm", () => {
  test("adapts the name label to people and companies", () => {
    render(<ClientForm onSubmit={vi.fn()} onCancel={vi.fn()} />);

    expect(screen.getByLabelText("Nombre completo")).toBeInTheDocument();
    expect(screen.getByLabelText("Tipo de cliente").tagName).toBe("BUTTON");

    fireEvent.click(screen.getByLabelText("Tipo de cliente"));
    fireEvent.click(screen.getByRole("option", { name: "Empresa" }));

    expect(screen.getByLabelText("Razón social")).toBeInTheDocument();
  });

  test("validates the name before submitting", async () => {
    const onSubmit = vi.fn();
    render(<ClientForm onSubmit={onSubmit} onCancel={vi.fn()} />);

    fireEvent.change(screen.getByLabelText("Nombre completo"), {
      target: { value: "A" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Crear cliente" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Ingresa al menos 2 caracteres.",
    );
    expect(onSubmit).not.toHaveBeenCalled();
  });

  test("normalizes optional fields and submits a company", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<ClientForm onSubmit={onSubmit} onCancel={vi.fn()} />);

    fireEvent.click(screen.getByLabelText("Tipo de cliente"));
    fireEvent.click(screen.getByRole("option", { name: "Empresa" }));
    fireEvent.change(screen.getByLabelText("Razón social"), {
      target: { value: "  Constructora del Sur S.A.  " },
    });
    fireEvent.change(screen.getByLabelText("Tipo de documento"), {
      target: { value: "RUC" },
    });
    fireEvent.change(screen.getByLabelText("Número de documento"), {
      target: { value: " 20123456789 " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Crear cliente" }));

    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith({
        type: "company",
        name: "Constructora del Sur S.A.",
        documentType: "RUC",
        documentNumber: "20123456789",
      }),
    );
  });

  test("edits existing data and supports cancellation", () => {
    const onCancel = vi.fn();
    render(
      <ClientForm
        initialClient={{
          id: "client-1",
          type: "person",
          name: "Ana Torres",
          documentType: "DNI",
          documentNumber: "44556677",
          email: null,
          phone: null,
          address: null,
          notes: null,
          createdAt: "2026-08-05T10:00:00.000Z",
          updatedAt: "2026-08-05T10:00:00.000Z",
        }}
        onSubmit={vi.fn()}
        onCancel={onCancel}
      />,
    );

    expect(screen.getByDisplayValue("Ana Torres")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Guardar cambios" }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(onCancel).toHaveBeenCalledOnce();
  });
});
