import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { CaseUpdatesSection } from "./case-updates-section";

Element.prototype.scrollIntoView = vi.fn();

const mocks = vi.hoisted(() => ({
  mutateCreate: vi.fn(),
  mutateUpdate: vi.fn(),
  mutateArchive: vi.fn(),
  mutateRestore: vi.fn(),
  invalidateQueries: vi.fn(),
  query: {
    data: {
      pages: [
        {
          updates: [
            {
              id: "update-1",
              caseId: "case-1",
              date: "2026-08-21",
              description: "Sentencia de primera instancia",
              kind: "update",
              creator: {
                userId: "user-1",
                fullName: "Ana Torres",
                alias: "AT",
                avatarColor: "#4057ed",
                activeStudioMember: true,
                linkable: true,
              },
              createdAt: "2026-08-21T15:00:00.000Z",
              updatedAt: "2026-08-21T15:00:00.000Z",
              archivedAt: null,
            },
          ],
          pagination: { page: 1, pageSize: 10, total: 1, totalPages: 1 },
        },
      ],
    } as unknown,
    isPending: false,
    isError: false,
    isFetchingNextPage: false,
    hasNextPage: false,
    refetch: vi.fn(),
    fetchNextPage: vi.fn(),
  },
  backgroundQuery: {
    data: {
      pages: [
        {
          updates: [
            {
              id: "background-1",
              caseId: "case-1",
              date: "2026-07-10",
              description: "Inicio de la fiscalización",
              kind: "background",
              creator: {
                userId: "user-1",
                fullName: "Ana Torres",
                alias: "AT",
                avatarColor: "#4057ed",
                activeStudioMember: true,
                linkable: true,
              },
              createdAt: "2026-07-10T15:00:00.000Z",
              updatedAt: "2026-07-10T15:00:00.000Z",
              archivedAt: null,
            },
          ],
          pagination: { page: 1, pageSize: 10, total: 1, totalPages: 1 },
        },
      ],
    } as unknown,
    isPending: false,
    isError: false,
    isFetchingNextPage: false,
    hasNextPage: false,
    refetch: vi.fn(),
    fetchNextPage: vi.fn(),
  },
}));

vi.mock("@tanstack/react-query", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-query")>();
  return {
    ...actual,
    useInfiniteQuery: (options: { queryKey: unknown[] }) =>
      JSON.stringify(options.queryKey).includes("background")
        ? mocks.backgroundQuery
        : mocks.query,
    useQueryClient: () => ({ invalidateQueries: mocks.invalidateQueries }),
  };
});

vi.mock("@/lib/api/generated/case-updates/case-updates", () => ({
  getListCaseUpdatesQueryKey: (_caseId: string, params?: unknown) => [
    "case-updates",
    params,
  ],
  listCaseUpdates: vi.fn(),
  useCreateCaseUpdate: () => ({
    isPending: false,
    mutateAsync: mocks.mutateCreate,
  }),
  useUpdateCaseUpdate: () => ({
    isPending: false,
    mutateAsync: mocks.mutateUpdate,
  }),
  useArchiveCaseUpdate: () => ({
    isPending: false,
    mutateAsync: mocks.mutateArchive,
  }),
  useRestoreCaseUpdate: () => ({
    isPending: false,
    mutateAsync: mocks.mutateRestore,
  }),
}));

vi.mock("@/lib/api/generated/cases/cases", () => ({
  getListCaseActivitiesQueryKey: () => ["case-activities"],
  getListCasesGroupedByClientQueryKey: () => ["cases-grouped"],
}));

vi.mock("@/lib/api/generated/dashboard/dashboard", () => ({
  getListDashboardActivityQueryKey: () => ["dashboard-activity"],
}));

vi.mock("@/components/ui/calendar-date-picker", () => ({
  calendarDateToDate: (value: string) => new Date(`${value}T00:00:00.000Z`),
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

describe("CaseUpdatesSection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.query.data = {
      pages: [
        {
          updates: [
            {
              id: "update-1",
              caseId: "case-1",
              date: "2026-08-21",
              description: "Sentencia de primera instancia",
              kind: "update",
              creator: {
                userId: "user-1",
                fullName: "Ana Torres",
                alias: "AT",
                avatarColor: "#4057ed",
                activeStudioMember: true,
                linkable: true,
              },
              createdAt: "2026-08-21T15:00:00.000Z",
              updatedAt: "2026-08-21T15:00:00.000Z",
              archivedAt: null,
            },
          ],
          pagination: { page: 1, pageSize: 10, total: 1, totalPages: 1 },
        },
      ],
    };
  });

  test("presents manual developments as a chronology", () => {
    render(
      <MemoryRouter>
        <CaseUpdatesSection caseId="case-1" disabled={false} />
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { name: "Novedades" })).toBeVisible();
    expect(screen.getByText("Sentencia de primera instancia")).toBeVisible();
    expect(screen.getByText(/21.*ago.*2026/i)).toBeVisible();
    expect(screen.getByRole("img", { name: "Ana Torres" })).toBeVisible();
    expect(screen.queryByText("Registró esta novedad")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("tab", { name: "Activas" }),
    ).not.toBeInTheDocument();
  });

  test("creates a development from the sheet", async () => {
    mocks.mutateCreate.mockResolvedValue({});
    render(
      <MemoryRouter>
        <CaseUpdatesSection caseId="case-1" disabled={false} />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Nueva novedad" }));
    fireEvent.change(screen.getByLabelText("Fecha"), {
      target: { value: "2026-08-11" },
    });
    fireEvent.change(screen.getByLabelText("Descripción"), {
      target: { value: "  Recurso de apelación del cliente  " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Guardar novedad" }));

    await waitFor(() =>
      expect(mocks.mutateCreate).toHaveBeenCalledWith({
        caseId: "case-1",
        data: {
          date: "2026-08-11",
          description: "Recurso de apelación del cliente",
        },
      }),
    );
  });

  test("marks the empty date instead of a valid description", () => {
    render(
      <MemoryRouter>
        <CaseUpdatesSection caseId="case-1" disabled={false} />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Nueva novedad" }));
    fireEvent.change(screen.getByLabelText("Descripción"), {
      target: { value: "Recurso de apelación del cliente" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Guardar novedad" }));

    expect(screen.getByLabelText("Fecha")).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    expect(screen.getByLabelText("Descripción")).toHaveAttribute(
      "aria-invalid",
      "false",
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Selecciona la fecha de la novedad.",
    );
    expect(mocks.mutateCreate).not.toHaveBeenCalled();
  });

  test("keeps backgrounds collapsed until requested", () => {
    render(
      <MemoryRouter>
        <CaseUpdatesSection caseId="case-1" disabled={false} />
      </MemoryRouter>,
    );

    expect(
      screen.getByRole("button", { name: "Antecedentes · 1" }),
    ).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("Inicio de la fiscalización")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Antecedentes · 1" }));
    expect(screen.getByText("Inicio de la fiscalización")).toBeVisible();
  });

  test("changes an individual novelty into a background", async () => {
    mocks.mutateUpdate.mockResolvedValue({});
    render(
      <MemoryRouter>
        <CaseUpdatesSection caseId="case-1" disabled={false} />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Editar novedad" }));
    fireEvent.click(screen.getByRole("combobox", { name: "Clasificación" }));
    fireEvent.click(screen.getByRole("option", { name: "Antecedente" }));
    fireEvent.click(screen.getByRole("button", { name: "Guardar novedad" }));

    await waitFor(() =>
      expect(mocks.mutateUpdate).toHaveBeenCalledWith({
        caseId: "case-1",
        updateId: "update-1",
        data: {
          date: "2026-08-21",
          description: "Sentencia de primera instancia",
          kind: "background",
          expectedUpdatedAt: "2026-08-21T15:00:00.000Z",
        },
      }),
    );
  });

  test("keeps archived cases read-only", () => {
    render(
      <MemoryRouter>
        <CaseUpdatesSection caseId="case-1" disabled />
      </MemoryRouter>,
    );
    expect(
      screen.queryByRole("button", { name: "Nueva novedad" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Editar novedad" }),
    ).not.toBeInTheDocument();
  });
});
