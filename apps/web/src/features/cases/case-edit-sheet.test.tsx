import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { CaseEditSheet } from "./case-edit-sheet";

const { mutateAsync, useGetCase, useUpdateCase } = vi.hoisted(() => ({
  mutateAsync: vi.fn(),
  useGetCase: vi.fn(),
  useUpdateCase: vi.fn(),
}));

vi.mock("@/lib/api/generated/cases/cases", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/generated/cases/cases")>()),
  useGetCase,
  useUpdateCase,
}));

vi.mock("./case-form", () => ({
  CaseForm: ({
    initial,
    onSubmit,
  }: {
    initial: { identification: string };
    onSubmit(input: {
      clientId: string;
      identification: string;
    }): Promise<void>;
  }) => (
    <div>
      <span>Formulario de {initial.identification}</span>
      <button
        onClick={() =>
          void onSubmit({
            clientId: "client-1",
            identification: "Caso editado",
          })
        }
      >
        Guardar formulario
      </button>
    </div>
  ),
}));

vi.mock("./case-people-settings", () => ({
  CasePeopleSettings: () => <div>Gestión de personas</div>,
}));

const record = {
  id: "case-1",
  identification: "Caso tributario",
  archivedAt: null,
  client: { id: "client-1", name: "Cliente Andes" },
};

function renderSheet(onOpenChange = vi.fn()) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return {
    onOpenChange,
    ...render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <CaseEditSheet
            open
            caseId="case-1"
            caseName="Caso tributario"
            clientName="Cliente Andes"
            onOpenChange={onOpenChange}
          />
        </MemoryRouter>
      </QueryClientProvider>,
    ),
  };
}

describe("CaseEditSheet", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useGetCase.mockReturnValue({
      data: { case: record },
      isPending: false,
      isError: false,
      refetch: vi.fn(),
    });
    useUpdateCase.mockReturnValue({ mutateAsync, isPending: false });
    mutateAsync.mockResolvedValue({});
  });

  test("loads the complete case only while the sheet is open", () => {
    renderSheet();

    expect(useGetCase).toHaveBeenCalledWith(
      "case-1",
      expect.objectContaining({
        query: expect.objectContaining({ enabled: true }),
      }),
    );
    expect(screen.getByRole("heading", { name: "Editar caso" })).toBeVisible();
    expect(screen.getByText("Formulario de Caso tributario")).toBeVisible();
  });

  test("keeps general data and team management in the same sheet", () => {
    renderSheet();

    fireEvent.mouseDown(screen.getByRole("tab", { name: "Personas" }), {
      button: 0,
      ctrlKey: false,
    });
    expect(screen.getByText("Gestión de personas")).toBeVisible();
  });

  test("updates the case and closes the sheet without navigating", async () => {
    const { onOpenChange } = renderSheet();

    fireEvent.click(screen.getByRole("button", { name: "Guardar formulario" }));

    await waitFor(() =>
      expect(mutateAsync).toHaveBeenCalledWith({
        caseId: "case-1",
        data: { clientId: "client-1", identification: "Caso editado" },
      }),
    );
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
