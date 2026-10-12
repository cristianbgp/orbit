import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { CaseForm } from "./case-form";

Element.prototype.scrollIntoView = vi.fn();

const { useGetCaseOptions } = vi.hoisted(() => ({
  useGetCaseOptions: vi.fn(),
}));

const caseOptions = {
  data: {
    types: [
      { value: "administrative", label: "Administrativo" },
      { value: "judicial", label: "Judicial" },
    ],
    subtypes: [],
    stages: [
      {
        value: "administrative_appeal",
        label: "Apelación",
        type: "administrative",
      },
      {
        value: "judicial_first_instance",
        label: "Primera instancia",
        type: "judicial",
      },
    ],
    entities: [],
    taxes: [],
    currencies: [],
    statuses: [
      { value: "in_progress", label: "En trámite" },
      { value: "concluded", label: "Concluido" },
    ],
    results: [],
  },
  isPending: false,
  isError: false,
  refetch: vi.fn(),
};

vi.mock("@/lib/api/generated/cases/cases", () => ({
  useGetCaseOptions,
}));
vi.mock("@/features/projects/client-selector", () => ({
  ClientSelector: ({
    onChange,
    error,
  }: {
    onChange(value: { id: string; name: string }): void;
    error?: string;
  }) => (
    <div>
      <button
        type="button"
        onClick={() => onChange({ id: "client-1", name: "BBVA" })}
      >
        Elegir cliente
      </button>
      {error ? <p role="alert">{error}</p> : null}
    </div>
  ),
}));
vi.mock("./case-member-picker", () => ({
  CaseMemberPicker: () => (
    <button type="button">Añadir miembros al caso</button>
  ),
}));
vi.mock("./case-period-picker", () => ({
  CasePeriodPicker: () => <button type="button">Período del caso</button>,
}));

describe("CaseForm", () => {
  beforeEach(() => {
    useGetCaseOptions.mockReturnValue(caseOptions);
  });

  test("uses the Orbit form sections and reusable shadcn selectors", () => {
    render(<CaseForm onSubmit={vi.fn()} onCancel={vi.fn()} />);
    expect(
      screen.getByRole("heading", { name: "Datos principales" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Clasificación" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Período e importe" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Período del caso" }),
    ).toBeInTheDocument();
    expect(
      screen.getAllByRole("button", { name: "Añadir miembros al caso" }),
    ).toHaveLength(2);
    expect(
      screen.getByRole("heading", { name: "Equipo inicial" }),
    ).toBeVisible();
    expect(
      screen.getByRole("heading", { name: "Seguimiento inicial" }),
    ).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Cancelar" }),
    ).toBeInTheDocument();
  });

  test("focuses and explains the first required field", () => {
    render(<CaseForm onSubmit={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Crear caso" }));
    expect(screen.getByLabelText("Identificación del caso")).toHaveFocus();
    expect(
      screen.getByText("Ingresa la identificación del caso."),
    ).toBeInTheDocument();
  });

  test("keeps main data limited to identification and client", () => {
    render(<CaseForm onSubmit={vi.fn()} />);

    const section = screen
      .getByRole("heading", { name: "Datos principales" })
      .closest("section");
    expect(section).toHaveTextContent("Identificación del caso");
    expect(section).toHaveTextContent("Cliente");
    expect(section).not.toHaveTextContent("Número de expediente");
    expect(section).not.toHaveTextContent("Demandante");
  });

  test("shows the docket only after selecting any stage", async () => {
    render(<CaseForm onSubmit={vi.fn()} />);

    expect(
      screen.queryByLabelText("Número de expediente"),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("combobox", { name: "Tipo" }));
    fireEvent.click(screen.getByRole("option", { name: "Administrativo" }));
    fireEvent.click(screen.getByRole("combobox", { name: "Etapa actual" }));
    fireEvent.click(screen.getByRole("option", { name: "Apelación" }));

    expect(screen.getByLabelText("Número de expediente")).toBeInTheDocument();
  });

  test("hides claimant for non-judicial cases and submits it empty", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<CaseForm onSubmit={onSubmit} />);

    fireEvent.change(screen.getByLabelText("Identificación del caso"), {
      target: { value: "Caso de prueba" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Elegir cliente" }));
    fireEvent.click(screen.getByRole("combobox", { name: "Tipo" }));
    fireEvent.click(screen.getByRole("option", { name: "Administrativo" }));
    expect(
      screen.queryByRole("combobox", { name: "Demandante" }),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Crear caso" }));

    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({ claimantType: null }),
      ),
    );
  });

  test("shows claimant for judicial cases and allows selecting SUNAT", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<CaseForm onSubmit={onSubmit} />);

    fireEvent.change(screen.getByLabelText("Identificación del caso"), {
      target: { value: "Caso de prueba" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Elegir cliente" }));
    fireEvent.click(screen.getByRole("combobox", { name: "Tipo" }));
    fireEvent.click(screen.getByRole("option", { name: "Judicial" }));
    expect(
      screen.getByRole("combobox", { name: "Demandante" }),
    ).toHaveTextContent("Cliente: BBVA");
    fireEvent.click(screen.getByRole("combobox", { name: "Demandante" }));
    fireEvent.click(screen.getByRole("option", { name: "SUNAT" }));
    fireEvent.click(screen.getByRole("button", { name: "Crear caso" }));

    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({ claimantType: "sunat" }),
      ),
    );
  });

  test("shows a retryable error instead of empty selectors when case options fail", () => {
    const refetch = vi.fn();
    useGetCaseOptions.mockReturnValue({
      data: undefined,
      isPending: false,
      isError: true,
      refetch,
    });

    render(<CaseForm onSubmit={vi.fn()} />);

    expect(screen.getByRole("alert")).toHaveTextContent(
      "No pudimos cargar las opciones del caso.",
    );
    fireEvent.click(screen.getByRole("button", { name: "Intentar de nuevo" }));
    expect(refetch).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Crear caso" })).toBeDisabled();
  });
});
