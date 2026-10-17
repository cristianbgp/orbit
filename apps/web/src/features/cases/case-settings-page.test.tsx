import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, test, vi } from "vitest";

import { ApiClientError } from "@/lib/api/fetcher";
import { CaseSettingsPage } from "./case-settings-page";

const { useGetCase } = vi.hoisted(() => ({ useGetCase: vi.fn() }));

vi.mock("@/lib/api/generated/cases/cases", () => ({
  getGetCaseQueryKey: () => ["case"],
  getListCasesGroupedByClientQueryKey: () => ["cases"],
  useGetCase,
  useUpdateCase: () => ({ isPending: false, mutateAsync: vi.fn() }),
  useArchiveCase: () => ({ isPending: false, mutateAsync: vi.fn() }),
  useRestoreCase: () => ({ isPending: false, mutateAsync: vi.fn() }),
}));

vi.mock("./case-form", () => ({
  CaseForm: () => <div>Formulario general del caso</div>,
}));

vi.mock("./case-people-settings", () => ({
  CasePeopleSettings: () => <div>Gestión de personas del caso</div>,
}));

vi.mock("@tanstack/react-query", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-query")>();
  return {
    ...actual,
    useQueryClient: () => ({ invalidateQueries: vi.fn() }),
  };
});

describe("CaseSettingsPage", () => {
  test("separates general data and team management like project settings", () => {
    useGetCase.mockReturnValue({
      data: {
        case: {
          id: "case-1",
          identification: "Caso de prueba",
          archivedAt: null,
          client: { id: "client-1", name: "Cliente" },
        },
      },
    });

    render(
      <MemoryRouter initialEntries={["/cases/case-1/settings"]}>
        <Routes>
          <Route
            path="/cases/:caseId/settings"
            element={<CaseSettingsPage />}
          />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText("Formulario general del caso")).toBeVisible();
    expect(
      screen.queryByText("Gestión de personas del caso"),
    ).not.toBeInTheDocument();

    expect(screen.getByRole("tab", { name: "General" })).toBeVisible();
    expect(screen.getByRole("tab", { name: "Personas" })).toBeVisible();
  });

  test("shows a retryable error instead of loading forever when the case request fails", () => {
    const refetch = vi.fn();
    useGetCase.mockReturnValue({
      data: undefined,
      isPending: false,
      isError: true,
      error: new ApiClientError("network", {
        kind: "network",
        retryable: true,
      }),
      refetch,
    });

    render(
      <MemoryRouter initialEntries={["/cases/case-1/settings"]}>
        <Routes>
          <Route
            path="/cases/:caseId/settings"
            element={<CaseSettingsPage />}
          />
        </Routes>
      </MemoryRouter>,
    );

    expect(
      screen.getByRole("heading", {
        name: "No pudimos cargar la configuración",
      }),
    ).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Intentar de nuevo" }));
    expect(refetch).toHaveBeenCalledTimes(1);
    expect(
      screen.queryByText("Cargando configuración…"),
    ).not.toBeInTheDocument();
  });

  test("shows a not-found state for a missing case", () => {
    useGetCase.mockReturnValue({
      data: undefined,
      isPending: false,
      isError: true,
      error: new ApiClientError("missing", {
        kind: "http",
        status: 404,
        retryable: false,
      }),
      refetch: vi.fn(),
    });

    render(
      <MemoryRouter initialEntries={["/cases/case-1/settings"]}>
        <Routes>
          <Route
            path="/cases/:caseId/settings"
            element={<CaseSettingsPage />}
          />
        </Routes>
      </MemoryRouter>,
    );

    expect(
      screen.getByRole("heading", { name: "Caso no encontrado" }),
    ).toBeVisible();
    expect(
      screen.getByRole("link", { name: "Volver a casos" }),
    ).toHaveAttribute("href", "/cases");
  });
});
