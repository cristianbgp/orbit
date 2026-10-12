import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { CaseEventsSection } from "./case-events-section";

Element.prototype.scrollIntoView = vi.fn();

const event = {
  id: "event-1",
  title: "Vista de la causa",
  type: "interview" as const,
  date: "2026-09-18",
  description: "Informe ante la Sala especializada",
  createdByUserId: "user-1",
  createdAt: "2026-09-03T10:00:00.000Z",
  updatedAt: "2026-09-03T10:00:00.000Z",
};

const mocks = vi.hoisted(() => ({
  query: {} as Record<string, unknown>,
  list: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
}));

vi.mock("@/lib/api/generated/case-events/case-events", async (original) => ({
  ...(await original<
    typeof import("@/lib/api/generated/case-events/case-events")
  >()),
  useListCaseEvents: (...args: unknown[]) => {
    mocks.list(...args);
    return mocks.query;
  },
  useCreateCaseEvent: () => ({
    mutateAsync: mocks.create,
    isPending: false,
  }),
  useUpdateCaseEvent: () => ({
    mutateAsync: mocks.update,
    isPending: false,
  }),
  useDeleteCaseEvent: () => ({
    mutateAsync: mocks.remove,
    isPending: false,
  }),
}));

vi.mock("@/components/ui/calendar-date-picker", () => ({
  calendarDateToDate: (value: string) => new Date(`${value}T00:00:00.000Z`),
  DatePicker: ({
    label,
    value,
    onChange,
  }: {
    label: string;
    value: string;
    onChange(value: string): void;
  }) => (
    <label>
      {label}
      <input
        aria-label={label}
        value={value}
        onChange={(inputEvent) => onChange(inputEvent.target.value)}
      />
    </label>
  ),
}));

function renderSection(disabled = false) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const result = render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <CaseEventsSection
          caseId="case-1"
          disabled={disabled}
          caseContext={{
            caseId: "case-1",
            caseName: "Proceso tributario",
            clientName: "Cliente Uno",
          }}
        />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return { ...result, client };
}

describe("CaseEventsSection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.create.mockResolvedValue({ event });
    mocks.update.mockResolvedValue({ event });
    mocks.remove.mockResolvedValue(undefined);
    mocks.query = {
      data: {
        events: [event],
        pagination: { page: 1, pageSize: 25, total: 1, totalPages: 1 },
      },
      isPending: false,
      isError: false,
      refetch: vi.fn(),
    };
  });

  test("presents typed events as a compact dated list", () => {
    renderSection();

    expect(screen.getByRole("heading", { name: "Eventos" })).toBeVisible();
    expect(
      screen.getByText(
        "Fechas relevantes del caso, como informes orales, entrevistas u otros eventos.",
      ),
    ).toBeVisible();
    expect(screen.getByText("Vista de la causa")).toBeVisible();
    expect(screen.getByLabelText("Tipo de evento: Entrevista")).toBeVisible();
    expect(screen.queryByText("Entrevista")).not.toBeInTheDocument();
    expect(screen.getByText(/18.*set.*2026/i)).toBeVisible();
    expect(
      screen.getByText("Informe ante la Sala especializada"),
    ).toBeVisible();
  });

  test("creates an event and refreshes event and activity queries", async () => {
    mocks.query = {
      ...mocks.query,
      data: {
        events: [],
        pagination: { page: 1, pageSize: 25, total: 0, totalPages: 0 },
      },
    };
    const { client } = renderSection();
    const invalidate = vi.spyOn(client, "invalidateQueries");

    fireEvent.click(screen.getByRole("button", { name: "Nuevo evento" }));
    fireEvent.change(screen.getByLabelText("Título"), {
      target: { value: "Informe ante la Sala" },
    });
    fireEvent.change(screen.getByLabelText("Fecha"), {
      target: { value: "2026-09-18" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Guardar evento" }));

    await waitFor(() =>
      expect(mocks.create).toHaveBeenCalledWith({
        caseId: "case-1",
        data: {
          title: "Informe ante la Sala",
          type: "oral_argument",
          date: "2026-09-18",
          description: null,
        },
      }),
    );
    expect(
      invalidate.mock.calls.map(([options]) => options?.queryKey?.[0]),
    ).toEqual(
      expect.arrayContaining([
        "/api/case-events/calendar",
        "/api/cases/case-1/events",
        "/api/cases/case-1/activity",
        "/api/dashboard/activity",
      ]),
    );
  });

  test("edits and confirms deletion without losing the event snapshot", async () => {
    renderSection();

    fireEvent.click(
      screen.getByRole("button", { name: "Editar Vista de la causa" }),
    );
    fireEvent.change(screen.getByLabelText("Título"), {
      target: { value: "Vista reprogramada" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Guardar evento" }));
    await waitFor(() =>
      expect(mocks.update).toHaveBeenCalledWith({
        caseId: "case-1",
        eventId: "event-1",
        data: {
          title: "Vista reprogramada",
          type: "interview",
          date: "2026-09-18",
          description: "Informe ante la Sala especializada",
          expectedUpdatedAt: "2026-09-03T10:00:00.000Z",
        },
      }),
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Eliminar Vista de la causa" }),
    );
    expect(
      screen.getByRole("heading", { name: "Eliminar evento" }),
    ).toBeVisible();
    expect(screen.getAllByText(/Vista de la causa/)).toHaveLength(2);
    fireEvent.click(
      screen.getByRole("button", { name: "Confirmar eliminación" }),
    );
    await waitFor(() =>
      expect(mocks.remove).toHaveBeenCalledWith({
        caseId: "case-1",
        eventId: "event-1",
        data: { expectedUpdatedAt: "2026-09-03T10:00:00.000Z" },
      }),
    );
  });

  test("keeps the confirmation open and explains a failed deletion", async () => {
    mocks.remove.mockRejectedValueOnce(new Error("network"));
    renderSection();

    fireEvent.click(
      screen.getByRole("button", { name: "Eliminar Vista de la causa" }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Confirmar eliminación" }),
    );

    expect(
      await screen.findByText(
        "No pudimos eliminar el evento. Recarga la página e inténtalo nuevamente.",
      ),
    ).toBeVisible();
    expect(screen.getByRole("dialog")).toBeVisible();
  });

  test("keeps archived cases readable without mutation controls", () => {
    renderSection(true);

    expect(screen.getByText("Vista de la causa")).toBeVisible();
    expect(
      screen.queryByRole("button", { name: "Nuevo evento" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Editar Vista de la causa" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Eliminar Vista de la causa" }),
    ).not.toBeInTheDocument();
  });
});
