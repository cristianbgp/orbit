import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { CasePortfolioFollowUp } from "./case-portfolio-follow-up";

const mocks = vi.hoisted(() => ({
  actions: vi.fn(),
  updates: vi.fn(),
  createAction: vi.fn(),
  createUpdate: vi.fn(),
  updateAction: vi.fn(),
  completeAction: vi.fn(),
  reopenAction: vi.fn(),
  updateNovelty: vi.fn(),
}));

vi.mock("@/lib/api/generated/case-actions/case-actions", () => ({
  getListCaseActionsQueryKey: (_caseId: string, params: unknown) => [
    "case-actions",
    params,
  ],
  listCaseActions: mocks.actions,
  useCreateCaseAction: () => ({
    isPending: false,
    mutateAsync: mocks.createAction,
  }),
  useUpdateCaseAction: () => ({
    isPending: false,
    mutateAsync: mocks.updateAction,
  }),
  useCompleteCaseAction: () => ({
    isPending: false,
    mutateAsync: mocks.completeAction,
  }),
  useReopenCaseAction: () => ({
    isPending: false,
    mutateAsync: mocks.reopenAction,
  }),
}));

vi.mock("@/lib/api/generated/case-updates/case-updates", () => ({
  getListCaseUpdatesQueryKey: (_caseId: string, params: unknown) => [
    "case-updates",
    params,
  ],
  listCaseUpdates: mocks.updates,
  useCreateCaseUpdate: () => ({
    isPending: false,
    mutateAsync: mocks.createUpdate,
  }),
  useUpdateCaseUpdate: () => ({
    isPending: false,
    mutateAsync: mocks.updateNovelty,
  }),
}));

vi.mock("@/lib/api/generated/cases/cases", () => ({
  getListCaseActivitiesQueryKey: () => ["case-activities"],
  getListCasesGroupedByClientQueryKey: () => ["cases-grouped"],
  useListCaseAssignments: () => ({
    data: { active: [], history: [], historyTotal: 0 },
    isPending: false,
    isError: false,
  }),
}));

function renderFollowUp(actionCount = 5, updateCount = 4, readOnly = false) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <CasePortfolioFollowUp
          caseId="case-1"
          caseName="Caso de prueba"
          clientName="Cliente de prueba"
          actionCount={actionCount}
          updateCount={updateCount}
          readOnly={readOnly}
        />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const action = (id: string, description: string) => ({
  id,
  caseId: "case-1",
  description,
  status: "pending",
  assignee: null,
  creator: {
    userId: "user-1",
    fullName: "Ana Torres",
    alias: "AT",
    avatarColor: null,
    activeStudioMember: true,
    activeCaseMember: true,
    linkable: true,
  },
  completedAt: null,
  completedByUserId: null,
  createdAt: "2026-09-03T12:00:00.000Z",
  updatedAt: "2026-09-03T12:00:00.000Z",
  archivedAt: null,
});

const update = (id: string, description: string) => ({
  id,
  caseId: "case-1",
  date: "2026-09-03",
  description,
  kind: "update",
  creator: {
    userId: "user-1",
    fullName: "Ana Torres",
    alias: "AT",
    avatarColor: null,
    activeStudioMember: true,
    linkable: true,
  },
  createdAt: "2026-09-03T12:00:00.000Z",
  updatedAt: "2026-09-03T12:00:00.000Z",
  archivedAt: null,
});

describe("CasePortfolioFollowUp", () => {
  beforeEach(() => vi.clearAllMocks());

  test("loads each three-item preview only after its own disclosure opens", async () => {
    mocks.actions.mockResolvedValue({
      actions: [action("a-1", "Primera acción")],
      pagination: { page: 1, pageSize: 3, total: 5, totalPages: 2 },
    });
    mocks.updates.mockResolvedValue({
      updates: [update("u-1", "Primera novedad")],
      pagination: { page: 1, pageSize: 3, total: 4, totalPages: 2 },
    });
    renderFollowUp();

    expect(mocks.actions).not.toHaveBeenCalled();
    expect(mocks.updates).not.toHaveBeenCalled();
    const followUp = screen.getByRole("group", {
      name: "Seguimiento del caso",
    });
    expect(
      within(followUp)
        .getAllByRole("button")
        .map(
          (button) => button.getAttribute("aria-label") ?? button.textContent,
        ),
    ).toEqual([
      "Novedades · 4",
      "Añadir novedad",
      "Acciones · 5",
      "Añadir acción",
    ]);
    fireEvent.click(screen.getByRole("button", { name: "Acciones · 5" }));

    await waitFor(() =>
      expect(mocks.actions).toHaveBeenCalledWith(
        "case-1",
        { status: "active", page: 1, pageSize: 3 },
        expect.objectContaining({ signal: expect.any(AbortSignal) }),
      ),
    );
    expect(await screen.findByText("Primera acción")).toBeVisible();
    expect(mocks.updates).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Novedades · 4" }));
    expect(await screen.findByText("Primera novedad")).toBeVisible();
  });

  test("opens a contextual novelty sheet without expanding its preview", () => {
    renderFollowUp();

    expect(
      screen.getByRole("button", { name: "Novedades · 4" }),
    ).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(screen.getByRole("button", { name: "Añadir novedad" }));

    expect(
      screen.getByRole("heading", { name: "Nueva novedad" }),
    ).toBeVisible();
    expect(
      screen.getByRole("region", { name: "Contexto del caso" }),
    ).toHaveTextContent("Caso de prueba");
    expect(
      screen.getByRole("region", { name: "Contexto del caso" }),
    ).toHaveTextContent("Cliente de prueba");
    expect(mocks.updates).not.toHaveBeenCalled();
  });

  test("opens a contextual action sheet and hides creation for archived cases", () => {
    const { unmount } = renderFollowUp();

    fireEvent.click(screen.getByRole("button", { name: "Añadir acción" }));

    expect(screen.getByRole("heading", { name: "Nueva acción" })).toBeVisible();
    expect(
      screen.getByRole("region", { name: "Contexto del caso" }),
    ).toHaveTextContent("Caso de prueba");

    unmount();
    renderFollowUp(5, 4, true);
    expect(
      screen.queryByRole("button", { name: "Añadir novedad" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Añadir acción" }),
    ).not.toBeInTheDocument();
  });

  test("expands and collapses every action inline", async () => {
    mocks.actions.mockImplementation((_caseId, params: { page: number }) =>
      Promise.resolve(
        params.page === 1
          ? {
              actions: [
                action("a-1", "Primera acción"),
                action("a-2", "Segunda acción"),
                action("a-3", "Tercera acción"),
              ],
              pagination: { page: 1, pageSize: 3, total: 5, totalPages: 2 },
            }
          : {
              actions: [
                action("a-4", "Cuarta acción"),
                action("a-5", "Quinta acción"),
              ],
              pagination: { page: 2, pageSize: 3, total: 5, totalPages: 2 },
            },
      ),
    );
    mocks.updates.mockResolvedValue({
      updates: [],
      pagination: { page: 1, pageSize: 3, total: 0, totalPages: 0 },
    });
    renderFollowUp();

    fireEvent.click(screen.getByRole("button", { name: "Acciones · 5" }));
    fireEvent.click(
      await screen.findByRole("button", { name: "Ver todas las acciones" }),
    );
    expect(await screen.findByText("Quinta acción")).toBeVisible();

    fireEvent.click(
      screen.getByRole("button", { name: "Mostrar menos acciones" }),
    );
    expect(screen.queryByText("Quinta acción")).not.toBeInTheDocument();
    expect(screen.getByText("Primera acción")).toBeVisible();
  });

  test("disables disclosures without active follow-up", () => {
    renderFollowUp(0, 0);
    expect(screen.getByRole("button", { name: "Acciones · 0" })).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Novedades · 0" }),
    ).toBeDisabled();
  });

  test("edits a novelty directly from its portfolio preview", async () => {
    mocks.updates.mockResolvedValue({
      updates: [update("u-1", "Primera novedad")],
      pagination: { page: 1, pageSize: 3, total: 1, totalPages: 1 },
    });
    renderFollowUp(0, 1);

    fireEvent.click(screen.getByRole("button", { name: "Novedades · 1" }));
    fireEvent.click(
      await screen.findByRole("button", { name: "Editar novedad" }),
    );

    expect(
      screen.getByRole("heading", { name: "Editar novedad" }),
    ).toBeVisible();
    fireEvent.change(screen.getByLabelText("Descripción"), {
      target: { value: "Novedad corregida" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Guardar novedad" }));

    await waitFor(() =>
      expect(mocks.updateNovelty).toHaveBeenCalledWith({
        caseId: "case-1",
        updateId: "u-1",
        data: {
          date: "2026-09-03",
          description: "Novedad corregida",
          kind: "update",
          expectedUpdatedAt: "2026-09-03T12:00:00.000Z",
        },
      }),
    );
  });

  test("changes an action status and opens editing from its portfolio row", async () => {
    mocks.actions.mockResolvedValue({
      actions: [action("a-1", "Primera acción")],
      pagination: { page: 1, pageSize: 3, total: 1, totalPages: 1 },
    });
    mocks.completeAction.mockResolvedValue({});
    renderFollowUp(1, 0);

    fireEvent.click(screen.getByRole("button", { name: "Acciones · 1" }));
    const status = await screen.findByRole("combobox", {
      name: /Cambiar estado de Primera acción/i,
    });
    expect(status).not.toHaveTextContent("Pendiente");
    fireEvent.click(status);
    fireEvent.click(screen.getByRole("option", { name: "Completada" }));
    await waitFor(() =>
      expect(mocks.completeAction).toHaveBeenCalledWith({
        caseId: "case-1",
        actionId: "a-1",
        data: { expectedUpdatedAt: "2026-09-03T12:00:00.000Z" },
      }),
    );

    fireEvent.click(screen.getByRole("button", { name: "Editar acción" }));
    expect(
      screen.getByRole("heading", { name: "Editar acción" }),
    ).toBeVisible();
  });

  test("lets disclosure controls shrink beside their create buttons", () => {
    renderFollowUp();

    for (const name of ["Novedades · 4", "Acciones · 5"]) {
      const disclosure = screen.getByRole("button", { name });
      expect(disclosure).toHaveClass("min-w-0", "flex-1", "shrink");
      expect(disclosure).not.toHaveClass("w-full");
    }
  });

  test("keeps loaded actions and retries after a later page fails", async () => {
    let thirdPageFails = true;
    mocks.actions.mockImplementation((_caseId, params: { page: number }) => {
      if (params.page === 1)
        return Promise.resolve({
          actions: [
            action("a-1", "Primera acción"),
            action("a-2", "Segunda acción"),
            action("a-3", "Tercera acción"),
          ],
          pagination: { page: 1, pageSize: 3, total: 7, totalPages: 3 },
        });
      if (params.page === 2)
        return Promise.resolve({
          actions: [
            action("a-4", "Cuarta acción"),
            action("a-5", "Quinta acción"),
            action("a-6", "Sexta acción"),
          ],
          pagination: { page: 2, pageSize: 3, total: 7, totalPages: 3 },
        });
      if (thirdPageFails) return Promise.reject(new Error("network"));
      return Promise.resolve({
        actions: [action("a-7", "Séptima acción")],
        pagination: { page: 3, pageSize: 3, total: 7, totalPages: 3 },
      });
    });
    renderFollowUp(7, 0);

    fireEvent.click(screen.getByRole("button", { name: "Acciones · 7" }));
    fireEvent.click(
      await screen.findByRole("button", { name: "Ver todas las acciones" }),
    );
    expect(await screen.findByText("Sexta acción")).toBeVisible();
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "No pudimos cargar todas las acciones",
    );

    thirdPageFails = false;
    fireEvent.click(
      screen.getByRole("button", {
        name: "Reintentar cargar todas las acciones",
      }),
    );
    expect(await screen.findByText("Séptima acción")).toBeVisible();
  });
});
