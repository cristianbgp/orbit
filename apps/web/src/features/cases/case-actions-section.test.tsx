import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { CaseActionsSection } from "./case-actions-section";

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  complete: vi.fn(),
  update: vi.fn(),
  reopen: vi.fn(),
  archive: vi.fn(),
  restore: vi.fn(),
  invalidate: vi.fn(),
  query: {
    data: {
      pages: [
        {
          actions: [
            {
              id: "action-1",
              caseId: "case-1",
              description: "Preparar escrito",
              status: "pending",
              assignee: null,
              creator: {
                userId: "user-1",
                fullName: "Ana",
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
            },
          ],
          pagination: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
        },
      ],
    },
    isPending: false,
    isError: false,
    isFetchingNextPage: false,
    hasNextPage: false,
    refetch: vi.fn(),
    fetchNextPage: vi.fn(),
  },
}));
Element.prototype.scrollIntoView = vi.fn();
const infiniteQueryOptions = vi.fn();
vi.mock("@tanstack/react-query", async (original) => ({
  ...(await original<typeof import("@tanstack/react-query")>()),
  useInfiniteQuery: (options: unknown) => {
    infiniteQueryOptions(options);
    return mocks.query;
  },
  useQueryClient: () => ({ invalidateQueries: mocks.invalidate }),
}));
vi.mock("@/lib/api/generated/case-actions/case-actions", () => ({
  getListCaseActionsQueryKey: (_caseId: string, params: unknown) => [
    "case-actions",
    params,
  ],
  listCaseActions: vi.fn(),
  useCreateCaseAction: () => ({ isPending: false, mutateAsync: mocks.create }),
  useUpdateCaseAction: () => ({ isPending: false, mutateAsync: mocks.update }),
  useCompleteCaseAction: () => ({
    isPending: false,
    mutateAsync: mocks.complete,
  }),
  useReopenCaseAction: () => ({ isPending: false, mutateAsync: mocks.reopen }),
  useArchiveCaseAction: () => ({
    isPending: false,
    mutateAsync: mocks.archive,
  }),
  useRestoreCaseAction: () => ({
    isPending: false,
    mutateAsync: mocks.restore,
  }),
}));
vi.mock("@/lib/api/generated/cases/cases", () => ({
  getListCaseActivitiesQueryKey: () => ["activities"],
  getListCaseAssignmentsQueryKey: () => ["assignments"],
  useListCaseAssignments: () => ({ data: { active: [] } }),
}));
vi.mock("@/lib/api/generated/dashboard/dashboard", () => ({
  getListDashboardActivityQueryKey: () => ["dashboard"],
}));

describe("CaseActionsSection", () => {
  beforeEach(() => vi.clearAllMocks());
  test("shows pending and completed actions in one active list", () => {
    render(
      <MemoryRouter>
        <CaseActionsSection caseId="case-1" disabled={false} />
      </MemoryRouter>,
    );

    expect(screen.getByText("Preparar escrito")).toBeVisible();
    expect(
      screen.queryByRole("tab", { name: "Pendientes" }),
    ).not.toBeInTheDocument();
    expect(infiniteQueryOptions).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: expect.arrayContaining([
          expect.objectContaining({ status: "active" }),
        ]),
      }),
    );
  });
  test("creates an unassigned action without a date", async () => {
    mocks.create.mockResolvedValue({});
    render(
      <MemoryRouter>
        <CaseActionsSection caseId="case-1" disabled={false} />
      </MemoryRouter>,
    );
    expect(screen.getByText("Preparar escrito")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Nueva acción" }));
    fireEvent.change(screen.getByLabelText("Descripción"), {
      target: { value: "Solicitar antecedentes" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Guardar acción" }));
    await waitFor(() =>
      expect(mocks.create).toHaveBeenCalledWith({
        caseId: "case-1",
        data: { description: "Solicitar antecedentes", assigneeUserId: null },
      }),
    );
  });
  test("marks an action complete", async () => {
    mocks.complete.mockResolvedValue({});
    render(
      <MemoryRouter>
        <CaseActionsSection caseId="case-1" disabled={false} />
      </MemoryRouter>,
    );
    fireEvent.click(
      screen.getByRole("combobox", {
        name: /Cambiar estado de Preparar escrito/i,
      }),
    );
    fireEvent.click(screen.getByRole("option", { name: "Completada" }));
    await waitFor(() =>
      expect(mocks.complete).toHaveBeenCalledWith({
        caseId: "case-1",
        actionId: "action-1",
        data: { expectedUpdatedAt: "2026-09-03T12:00:00.000Z" },
      }),
    );
  });
  test("keeps archived cases read-only", () => {
    render(
      <MemoryRouter>
        <CaseActionsSection caseId="case-1" disabled />
      </MemoryRouter>,
    );
    expect(
      screen.queryByRole("button", { name: "Nueva acción" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("combobox", {
        name: /Cambiar estado de Preparar escrito/i,
      }),
    ).toBeDisabled();
  });
});
