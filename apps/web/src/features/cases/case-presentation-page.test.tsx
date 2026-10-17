import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { CasePresentationPage } from "./case-presentation-page";

const { presentationQuery, useGetCasePresentation } = vi.hoisted(() => ({
  presentationQuery: {
    data: {
      generatedAt: "2026-09-04T12:00:00.000Z",
      organizationDate: "2026-09-04",
      truncated: { value: false, scopes: [] },
      clients: [
        {
          id: "client-1",
          name: "Cliente Andes",
          cases: [
            {
              id: "case-1",
              identification: "Caso tributario",
              status: "in_progress",
              result: null,
              type: "judicial",
              stage: "judicial_first_instance",
              docketNumber: "EXP-001",
              team: [],
              followers: [],
              updates: [
                {
                  id: "update-1",
                  caseId: "case-1",
                  date: "2026-09-03",
                  description: "Sentencia notificada",
                  kind: "update",
                  creator: {
                    userId: "user-1",
                    fullName: "Ana",
                    alias: "AN",
                    avatarColor: null,
                    activeStudioMember: true,
                    linkable: true,
                  },
                  createdAt: "2026-09-03T12:00:00.000Z",
                  updatedAt: "2026-09-03T12:00:00.000Z",
                  archivedAt: null,
                },
              ],
              backgrounds: [],
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
                    alias: "AN",
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
              events: [
                {
                  id: "event-1",
                  title: "Informe oral",
                  type: "oral_argument",
                  date: "2026-09-18",
                  description: null,
                  createdByUserId: "user-1",
                  createdAt: "2026-09-03T12:00:00.000Z",
                  updatedAt: "2026-09-03T12:00:00.000Z",
                },
              ],
            },
          ],
        },
      ],
    },
    isPending: false,
    isError: false,
    isPlaceholderData: false,
    refetch: vi.fn(),
  },
  useGetCasePresentation: vi.fn(),
}));

vi.mock("@/lib/api/generated/cases/cases", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/generated/cases/cases")>()),
  useGetCasePresentation,
}));

vi.mock("./case-portfolio-filters", () => ({
  CasePortfolioFiltersBar: () => <div>Filtros de cartera</div>,
}));

vi.mock("./case-presentation-case", () => ({
  CasePresentationCase: ({
    item,
    open,
    onOpenChange,
  }: {
    item: (typeof presentationQuery.data.clients)[number]["cases"][number];
    open: boolean;
    onOpenChange(value: boolean): void;
  }) => (
    <article>
      <button onClick={() => onOpenChange(!open)}>
        {open ? "Contraer" : "Expandir"} {item.identification}
      </button>
      {open ? (
        <div>
          <span>{item.updates[0]?.description}</span>
          <span>{item.actions[0]?.description}</span>
          <span>{item.events[0]?.title}</span>
        </div>
      ) : null}
    </article>
  ),
}));

function LocationProbe() {
  return <output aria-label="URL actual">{useLocation().search}</output>;
}

function renderPage(initialEntry = "/cases/presentation") {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>
          <Route
            path="/cases/presentation"
            element={
              <>
                <CasePresentationPage />
                <LocationProbe />
              </>
            }
          />
          <Route path="/cases" element={<p>Cartera de casos</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("CasePresentationPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useGetCasePresentation.mockReturnValue(presentationQuery);
  });

  test("opens the complete active portfolio expanded", () => {
    renderPage();

    expect(
      screen.getByRole("heading", { name: "Presentación semanal" }),
    ).toBeVisible();
    expect(screen.getByText("Cliente Andes")).toBeVisible();
    expect(screen.getByText("Sentencia notificada")).toBeVisible();
    expect(screen.getByText("Preparar escrito")).toBeVisible();
    expect(screen.getByText("Informe oral")).toBeVisible();
  });

  test("collapses and expands the complete document", () => {
    renderPage();

    fireEvent.click(screen.getByRole("button", { name: "Contraer todo" }));
    expect(screen.queryByText("Sentencia notificada")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Expandir todo" }));
    expect(screen.getByText("Sentencia notificada")).toBeVisible();
  });

  test("collapses a client independently from its cases", () => {
    renderPage();

    fireEvent.click(screen.getByRole("button", { name: "Cliente Andes" }));
    expect(screen.queryByText("Sentencia notificada")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Cliente Andes" }));
    expect(screen.getByText("Sentencia notificada")).toBeVisible();
  });

  test("groups optional content in a clear visibility control", () => {
    renderPage();

    expect(screen.getByText("Estado del portafolio de casos")).toBeVisible();
    expect(
      screen.queryByRole("button", { name: /Modo presentación/ }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Incluir completadas" }),
    ).not.toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: "Contenido adicional" }),
    );
    expect(screen.getByText("Mostrar también")).toBeVisible();
    expect(
      screen.getByText("Agrega información histórica a la presentación."),
    ).toBeVisible();
    fireEvent.click(
      screen.getByRole("checkbox", { name: "Acciones completadas" }),
    );
    fireEvent.click(screen.getByRole("checkbox", { name: "Eventos pasados" }));

    expect(screen.getByLabelText("URL actual")).toHaveTextContent(
      "includeCompletedActions=true",
    );
    expect(screen.getByLabelText("URL actual")).toHaveTextContent(
      "includePastEvents=true",
    );
    expect(screen.getByLabelText("URL actual")).not.toHaveTextContent("mode=");
    expect(
      screen.getByRole("button", { name: "Contenido adicional · 2" }),
    ).toBeVisible();
  });

  test("exits the presentation directly to the cases portfolio", () => {
    renderPage();

    fireEvent.click(
      screen.getByRole("link", { name: "Salir de presentación" }),
    );

    expect(screen.getByText("Cartera de casos")).toBeVisible();
  });
});
