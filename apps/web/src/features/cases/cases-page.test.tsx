import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { CasesPage } from "./cases-page";

const {
  groupedCasesQuery,
  useListCasesGroupedByClient,
  previewGlobalMove,
  moveGlobal,
  calendarProps,
} = vi.hoisted(() => ({
  groupedCasesQuery: {
    data: {
      groups: [],
      caseTotal: 0,
      pagination: { page: 1, pageSize: 10, total: 0, totalPages: 0 },
    },
    isPending: false,
    isError: false,
    isPlaceholderData: false,
  },
  useListCasesGroupedByClient: vi.fn(),
  previewGlobalMove: vi.fn(),
  moveGlobal: vi.fn(),
  calendarProps: vi.fn(),
}));

vi.mock("./case-event-calendar", () => ({
  CaseEventCalendar: (props: Record<string, unknown>) => {
    calendarProps(props);
    return <div>Calendario de eventos</div>;
  },
}));

vi.mock(
  "@/lib/api/generated/case-updates/case-updates",
  async (importOriginal) => ({
    ...(await importOriginal<
      typeof import("@/lib/api/generated/case-updates/case-updates")
    >()),
    usePreviewMoveCaseUpdatesToBackground: () => ({
      data: { movedCount: 7, caseCount: 3 },
      isPending: false,
      isError: false,
      refetch: previewGlobalMove,
    }),
    useMoveCaseUpdatesToBackground: () => ({
      isPending: false,
      mutateAsync: moveGlobal,
    }),
  }),
);

vi.mock("@/lib/api/generated/cases/cases", () => ({
  useListCasesGroupedByClient,
  useListCaseAssignments: () => ({
    data: { active: [], history: [], historyTotal: 0 },
    isPending: false,
    isError: false,
  }),
  getListCaseActivitiesQueryKey: () => ["case-activities"],
  getListCasesGroupedByClientQueryKey: () => ["cases-grouped"],
}));

vi.mock("./case-portfolio-filters", () => ({
  CasePortfolioFiltersBar: () => <div>Filtros de casos</div>,
}));

function LocationProbe() {
  const location = useLocation();
  return <output aria-label="URL actual">{location.search}</output>;
}

describe("CasesPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useListCasesGroupedByClient.mockReturnValue(groupedCasesQuery);
  });

  test("switches between list and calendar while preserving portfolio filters", () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter
          initialEntries={[
            "/cases?display=calendar&month=2026-09&type=judicial&client=client-1&member=user-1&q=informe",
          ]}
        >
          <Routes>
            <Route
              path="/cases"
              element={
                <>
                  <CasesPage currentUserId="user-current" />
                  <LocationProbe />
                </>
              }
            />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(screen.getByText("Calendario de eventos")).toBeVisible();
    expect(calendarProps).toHaveBeenCalledWith(
      expect.objectContaining({
        month: "2026-09",
        caseStatus: "in_progress",
        search: "informe",
        filters: {
          types: ["judicial"],
          clientIds: ["client-1"],
          memberUserIds: ["user-1"],
        },
      }),
    );
    expect(useListCasesGroupedByClient).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        query: expect.objectContaining({ enabled: false }),
      }),
    );

    fireEvent.click(screen.getByRole("button", { name: "Vista de lista" }));
    expect(screen.getByLabelText("URL actual")).toHaveTextContent(
      "type=judicial&client=client-1&member=user-1&q=informe",
    );
    expect(screen.getByLabelText("URL actual")).not.toHaveTextContent(
      "display=calendar",
    );
  });

  test("uses lifecycle tabs and keeps the selected view in the URL", () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter initialEntries={["/cases"]}>
          <Routes>
            <Route
              path="/cases"
              element={
                <>
                  <CasesPage currentUserId="user-current" />
                  <LocationProbe />
                </>
              }
            />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(screen.getByRole("tab", { name: "En trámite" })).toBeVisible();
    expect(screen.getByRole("tab", { name: "Concluidos" })).toBeVisible();
    expect(screen.getByRole("tab", { name: "Archivados" })).toBeVisible();

    const concludedTab = screen.getByRole("tab", { name: "Concluidos" });
    fireEvent.mouseDown(concludedTab, { button: 0, ctrlKey: false });
    expect(screen.getByLabelText("URL actual")).toHaveTextContent(
      "?view=concluded",
    );
  });

  test("passes lifecycle and repeated portfolio filters to the grouped query", () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter
          initialEntries={[
            "/cases?view=concluded&type=judicial&type=other&client=client-1&member=user-1",
          ]}
        >
          <Routes>
            <Route
              path="/cases"
              element={<CasesPage currentUserId="user-current" />}
            />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(useListCasesGroupedByClient).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "concluded",
        type: ["judicial", "other"],
        client: ["client-1"],
        member: ["user-1"],
      }),
      expect.objectContaining({
        query: expect.objectContaining({
          placeholderData: expect.any(Function),
        }),
      }),
    );
  });

  test("toggles the current user as a shortcut to the member filter", () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter
          initialEntries={["/cases?type=judicial&member=user-other"]}
        >
          <Routes>
            <Route
              path="/cases"
              element={
                <>
                  <CasesPage currentUserId="user-current" />
                  <LocationProbe />
                </>
              }
            />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    const shortcut = screen.getByRole("button", { name: "Mis casos" });
    expect(shortcut).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(shortcut);
    expect(screen.getByLabelText("URL actual")).toHaveTextContent(
      "type=judicial&member=user-current",
    );
    expect(screen.getByLabelText("URL actual")).not.toHaveTextContent(
      "user-other",
    );
    expect(shortcut).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(shortcut);
    expect(screen.getByLabelText("URL actual")).toHaveTextContent(
      "type=judicial",
    );
    expect(screen.getByLabelText("URL actual")).not.toHaveTextContent(
      "member=",
    );
  });

  test("shows the case team without exposing the amount in the portfolio row", () => {
    useListCasesGroupedByClient.mockReturnValue({
      ...groupedCasesQuery,
      data: {
        groups: [
          {
            client: { id: "client-1", name: "Cliente de prueba" },
            cases: [
              {
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
                team: {
                  total: 1,
                  members: [
                    {
                      userId: "user-1",
                      fullName: "Ana Torres",
                      alias: "AT",
                      avatarColor: null,
                      position: "senior",
                    },
                  ],
                },
                followers: {
                  total: 1,
                  members: [
                    {
                      userId: "user-2",
                      fullName: "Bruno Díaz",
                      alias: "BD",
                      avatarColor: null,
                      position: "junior",
                    },
                  ],
                },
                activeActionCount: 2,
                activeUpdateCount: 1,
                archivedAt: null,
                createdByUserId: "user-1",
                createdAt: "2026-09-01T12:00:00.000Z",
                updatedAt: "2026-09-01T12:00:00.000Z",
              },
            ],
          },
        ],
        caseTotal: 1,
        pagination: { page: 1, pageSize: 10, total: 1, totalPages: 1 },
      },
    });

    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={["/cases"]}>
          <Routes>
            <Route
              path="/cases"
              element={<CasesPage currentUserId="user-current" />}
            />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    const people = screen.getByRole("group", {
      name: "Participación de Caso de prueba",
    });
    const team = within(people).getByRole("group", {
      name: "Equipo de Caso de prueba",
    });
    const followers = within(people).getByRole("group", {
      name: "Seguimiento de Caso de prueba",
    });
    expect(team).toBeVisible();
    expect(followers).toBeVisible();
    const scroller = within(people).getByRole("region", {
      name: "Equipo y seguimiento de Caso de prueba",
    });
    expect(people).toHaveClass("overflow-hidden");
    expect(scroller).toHaveClass("overflow-x-auto");
    expect(scroller).toHaveAttribute("tabindex", "0");
    expect(team).not.toHaveClass("overflow-x-auto");
    expect(followers).not.toHaveClass("overflow-x-auto");
    expect(within(people).getByText("Equipo")).toHaveClass("border-b");
    expect(within(people).getByText("Seguimiento")).toHaveClass("border-b");
    expect(within(people).queryByText("Personas")).not.toBeInTheDocument();
    expect(screen.queryByText(/123\.00/)).not.toBeInTheDocument();
    expect(screen.queryByText("IR")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Acciones · 2" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Novedades · 1" })).toBeVisible();
    expect(screen.getAllByText("1 caso")).toHaveLength(2);
    expect(screen.queryByText("1 casos")).not.toBeInTheDocument();

    const period = screen.getByText("Período");
    const docket = screen.getByText("Expediente");
    const stage = screen.getByText("Etapa");
    expect(period.compareDocumentPosition(docket)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
    expect(docket.compareDocumentPosition(stage)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
  });

  test("confirms and runs the organization-wide novelty conversion", async () => {
    moveGlobal.mockResolvedValue({ movedCount: 7, caseCount: 3 });
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={["/cases"]}>
          <CasesPage currentUserId="user-current" />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Más acciones de casos" }),
    );
    expect(
      screen.getByRole("menuitem", { name: "Ver presentación" }),
    ).toHaveAttribute("href", "/cases/presentation");
    fireEvent.click(
      screen.getByRole("menuitem", { name: "Pasar novedades a antecedentes" }),
    );

    expect(await screen.findByRole("dialog")).toHaveTextContent(
      "7 novedades de 3 casos",
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Confirmar conversión" }),
    );
    await waitFor(() => expect(moveGlobal).toHaveBeenCalledTimes(1));
  });
});
