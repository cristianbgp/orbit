import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { ApiClientError } from "@/lib/api/fetcher";
import { CaseDetailPage } from "./case-detail-page";

const { caseQuery, assignmentsQuery, useGetCase, useListCaseAssignments } =
  vi.hoisted(() => ({
    caseQuery: {
      data: undefined as unknown,
      error: null as unknown,
      isPending: false,
      isError: false,
      refetch: vi.fn(),
    },
    assignmentsQuery: {
      data: { active: [], history: [], historyTotal: 0 },
      isPending: false,
      isError: false,
      refetch: vi.fn(),
    },
    useGetCase: vi.fn(),
    useListCaseAssignments: vi.fn(),
  }));

vi.mock("@/lib/api/generated/cases/cases", () => ({
  getGetCaseQueryKey: () => ["case"],
  getListCaseActivitiesQueryKey: () => ["case-activities"],
  getListCaseAssignmentCandidatesQueryKey: () => ["case-candidates"],
  getListCaseAssignmentsQueryKey: () => ["case-assignments"],
  useGetCase,
  useListCaseAssignments,
  useListCaseAssignmentCandidates: () => ({
    data: { members: [] },
    isPending: false,
    isError: false,
    refetch: vi.fn(),
  }),
  useAddCaseAssignments: () => ({ isPending: false, mutateAsync: vi.fn() }),
  useEndCaseAssignment: () => ({ isPending: false, mutateAsync: vi.fn() }),
}));

vi.mock("./case-activity-list", () => ({
  CaseActivityList: () => <div>Actividad del caso</div>,
}));

vi.mock("./case-updates-section", () => ({
  CaseUpdatesSection: ({ disabled }: { disabled: boolean }) => (
    <div data-disabled={disabled}>Novedades del caso</div>
  ),
}));
vi.mock("./case-actions-section", () => ({
  CaseActionsSection: ({ disabled }: { disabled: boolean }) => (
    <div data-testid="case-actions" data-disabled={disabled}>
      Acciones del caso
    </div>
  ),
}));
vi.mock("./case-events-section", () => ({
  CaseEventsSection: ({ disabled }: { disabled: boolean }) => (
    <div data-testid="case-events" data-disabled={disabled}>
      Eventos del caso
    </div>
  ),
}));

const record = {
  id: "case-1",
  clientId: "client-1",
  client: { id: "client-1", name: "Cliente de prueba" },
  identification: "Caso de prueba",
  type: "judicial",
  subtype: "dca",
  stage: "judicial_first_instance",
  entity: "judiciary",
  docketNumber: "EXP-001",
  tax: "IR",
  periodKind: "year",
  periodStart: "2026-01-01",
  periodEnd: "2026-12-31",
  amount: "123.00",
  currency: "PEN",
  claimantType: "client",
  disputedMatter: null,
  challengedResolution: null,
  status: "in_progress",
  result: null,
  team: { members: [], total: 0 },
  followers: { members: [], total: 0 },
  archivedAt: null,
  createdByUserId: "user-1",
  createdAt: "2026-09-01T12:00:00.000Z",
  updatedAt: "2026-09-01T12:00:00.000Z",
};

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/cases/case-1"]}>
        <Routes>
          <Route path="/cases/:caseId" element={<CaseDetailPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("CaseDetailPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useGetCase.mockReturnValue({
      ...caseQuery,
      data: { case: record },
    });
    useListCaseAssignments.mockImplementation(() => assignmentsQuery);
  });

  test("matches the project detail navigation hierarchy", () => {
    renderPage();

    expect(
      screen.getByRole("link", { name: "Volver a casos" }),
    ).toHaveAttribute("href", "/cases");
    expect(
      screen.getByRole("link", { name: "Configurar caso" }),
    ).toHaveAttribute("href", "/cases/case-1/settings");
    expect(
      screen.getByRole("heading", { level: 1, name: "Caso de prueba" }),
    ).toBeVisible();
    expect(screen.getByText("Novedades del caso")).toBeVisible();
    expect(
      screen
        .getByText("Novedades del caso")
        .compareDocumentPosition(screen.getByText("Actividad del caso")) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  test("prioritizes events before updates, actions and activity", () => {
    renderPage();

    const events = screen.getByText("Eventos del caso");
    const updates = screen.getByText("Novedades del caso");
    const actions = screen.getByText("Acciones del caso");
    const activity = screen.getByText("Actividad del caso");

    expect(
      events.compareDocumentPosition(updates) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      updates.compareDocumentPosition(actions) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      actions.compareDocumentPosition(activity) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  test("summarizes the case with the same hierarchy as the project detail", () => {
    renderPage();

    const summary = screen.getByRole("region", { name: "Resumen del caso" });
    expect(summary).toHaveTextContent("En trámite");
    expect(summary).toHaveTextContent("Judicial");
    expect(summary).toHaveTextContent("Caso de prueba");
    expect(summary).toHaveTextContent("Cliente de prueba");
    expect(summary).toHaveTextContent("Situación procesal");
    expect(summary).toHaveTextContent("Primera Instancia");
    expect(summary).toHaveTextContent("Poder Judicial");
  });

  test("explains that an archived case is read-only", () => {
    useGetCase.mockReturnValue({
      ...caseQuery,
      data: {
        case: { ...record, archivedAt: "2026-09-02T12:00:00.000Z" },
      },
    });

    renderPage();

    expect(screen.getByRole("status")).toHaveTextContent(
      "Este caso está archivado y es de solo lectura.",
    );
    expect(screen.getByTestId("case-events")).toHaveAttribute(
      "data-disabled",
      "true",
    );
  });

  test("offers retry and navigation when loading fails", () => {
    const refetch = vi.fn();
    useGetCase.mockReturnValue({
      ...caseQuery,
      data: undefined,
      isError: true,
      error: new Error("network"),
      refetch,
    });

    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Intentar de nuevo" }));

    expect(refetch).toHaveBeenCalledOnce();
    expect(
      screen.getByRole("link", { name: "Volver a casos" }),
    ).toHaveAttribute("href", "/cases");
  });

  test("announces the loading state without changing the page footprint", () => {
    useGetCase.mockReturnValue({
      ...caseQuery,
      data: undefined,
      isPending: true,
    });

    renderPage();

    expect(
      screen.getByRole("status", { name: "Cargando caso" }),
    ).toHaveAttribute("aria-live", "polite");
  });

  test("distinguishes a missing case from a temporary loading error", () => {
    useGetCase.mockReturnValue({
      ...caseQuery,
      data: undefined,
      isError: true,
      error: new ApiClientError("missing", {
        kind: "http",
        status: 404,
        retryable: false,
      }),
    });

    renderPage();

    expect(
      screen.getByRole("heading", { name: "Caso no encontrado" }),
    ).toBeVisible();
    expect(
      screen.getByRole("link", { name: "Volver a casos" }),
    ).toHaveAttribute("href", "/cases");
  });

  test("does not render a fake link for an unavailable member profile", () => {
    useListCaseAssignments.mockImplementation((_id, params) =>
      params?.responsibility === "follower"
        ? assignmentsQuery
        : {
            data: {
              active: [
                {
                  id: "assignment-2",
                  userId: "user-3",
                  userAlias: "BD",
                  userName: "Bruno Díaz",
                  userEmail: "bruno@orbit.pe",
                  userAvatarColor: "#111827",
                  position: "senior",
                  activeStudioMember: true,
                  assignedAt: "2026-08-02T12:00:00.000Z",
                  endedAt: null,
                },
                {
                  id: "assignment-1",
                  userId: null,
                  userAlias: "AR",
                  userName: "Ana Retirada",
                  userEmail: "ana@orbit.pe",
                  userAvatarColor: null,
                  position: "senior",
                  activeStudioMember: false,
                  assignedAt: "2026-08-01T12:00:00.000Z",
                  endedAt: null,
                },
              ],
              history: [],
              historyTotal: 0,
            },
            isPending: false,
            isError: false,
            refetch: vi.fn(),
          },
    );

    renderPage();

    expect(
      screen.getByRole("img", { name: "Ana Retirada" }).closest("a"),
    ).toBeNull();
  });

  test("shows case members with the same useful identity details as projects", () => {
    useListCaseAssignments.mockImplementation((_id, params) =>
      params?.responsibility === "follower"
        ? assignmentsQuery
        : {
            data: {
              active: [
                {
                  id: "assignment-2",
                  userId: "user-3",
                  userAlias: "BD",
                  userName: "Bruno Díaz",
                  userEmail: "bruno@orbit.pe",
                  userAvatarColor: "#111827",
                  position: "senior",
                  activeStudioMember: true,
                  assignedAt: "2026-08-02T12:00:00.000Z",
                  endedAt: null,
                },
                {
                  id: "assignment-1",
                  userId: "user-2",
                  userAlias: "AT",
                  userName: "Ana Torres",
                  userEmail: "ana@orbit.pe",
                  userAvatarColor: "#3156d3",
                  position: "partner",
                  activeStudioMember: true,
                  assignedAt: "2026-08-01T12:00:00.000Z",
                  endedAt: null,
                },
              ],
              history: [],
              historyTotal: 0,
            },
            isPending: false,
            isError: false,
            refetch: vi.fn(),
          },
    );

    renderPage();

    expect(screen.getByText("ana@orbit.pe")).toBeVisible();
    expect(screen.getByText("Socio")).toBeVisible();
    expect(screen.getByText(/Desde 1 ago\. 2026/)).toBeVisible();
    expect(screen.getByRole("link", { name: /Ana Torres/ })).toHaveAttribute(
      "href",
      "/team/user-2",
    );
    const groups = screen.getAllByRole("group", { name: /^(Socio|Senior)$/ });
    expect(groups.map((group) => group.getAttribute("aria-label"))).toEqual([
      "Socio",
      "Senior",
    ]);
  });

  test("keeps previous participation out of the current interface", () => {
    useListCaseAssignments.mockImplementation((_id, params) =>
      params?.responsibility === "follower"
        ? assignmentsQuery
        : {
            ...assignmentsQuery,
            data: {
              active: [],
              history: [
                {
                  id: "old-assignment",
                  userId: "user-old",
                  userAlias: "AR",
                  userName: "Ana Retirada",
                  userEmail: "ana@orbit.pe",
                  userAvatarColor: null,
                  position: "senior",
                  activeStudioMember: true,
                  assignedAt: "2026-08-01T12:00:00.000Z",
                  endedAt: "2026-08-10T12:00:00.000Z",
                },
              ],
              historyTotal: 1,
            },
          },
    );

    renderPage();

    expect(
      screen.queryByText("Participación anterior"),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("Ana Retirada")).not.toBeInTheDocument();
  });

  test("hides judicial-only and stage-dependent fields when they do not apply", () => {
    useGetCase.mockReturnValue({
      ...caseQuery,
      data: {
        case: {
          ...record,
          type: "administrative",
          stage: null,
          docketNumber: null,
          claimantType: null,
        },
      },
    });

    renderPage();

    expect(screen.queryByText("Expediente")).not.toBeInTheDocument();
    expect(screen.queryByText("Demandante")).not.toBeInTheDocument();
  });
});
