import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { ProjectEventsSettings } from "@/features/projects/project-events-settings";

const mocks = vi.hoisted(() => ({
  query: {} as Record<string, unknown>,
  list: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
}));

vi.mock(
  "@/lib/api/generated/project-events/project-events",
  async (original) => ({
    ...(await original<
      typeof import("@/lib/api/generated/project-events/project-events")
    >()),
    useListProjectEvents: (...args: unknown[]) => {
      mocks.list(...args);
      return mocks.query;
    },
    useCreateProjectEvent: () => ({
      mutateAsync: mocks.create,
      isPending: false,
    }),
    useUpdateProjectEvent: () => ({
      mutateAsync: mocks.update,
      isPending: false,
    }),
    useDeleteProjectEvent: () => ({
      mutateAsync: mocks.remove,
      isPending: false,
    }),
  }),
);

vi.stubGlobal(
  "ResizeObserver",
  class {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
);

const legalEvent = {
  id: "event-1",
  projectId: "project-1",
  title: "Audiencia de vista",
  type: "legal" as const,
  date: "2026-08-18",
  description: null,
  createdAt: "2026-08-01T10:00:00.000Z",
  updatedAt: "2026-08-01T10:00:00.000Z",
};

function renderSettings(readOnly = false) {
  const client = new QueryClient();
  const result = render(
    <QueryClientProvider client={client}>
      <ProjectEventsSettings
        projectId="project-1"
        projectStartDate="2026-08-06"
        readOnly={readOnly}
      />
    </QueryClientProvider>,
  );
  return { ...result, client };
}

describe("ProjectEventsSettings", () => {
  beforeEach(() => {
    mocks.list.mockReset();
    mocks.create.mockReset().mockResolvedValue({ event: legalEvent });
    mocks.update.mockReset().mockResolvedValue({ event: legalEvent });
    mocks.remove.mockReset().mockResolvedValue(undefined);
    mocks.query = {
      data: {
        events: [legalEvent],
        pagination: { page: 1, pageSize: 100, total: 1, totalPages: 1 },
      },
      isPending: false,
      isError: false,
      refetch: vi.fn(),
    };
  });

  test("keeps an empty event collection compact and explicit", () => {
    mocks.query = {
      ...mocks.query,
      data: {
        events: [],
        pagination: { page: 1, pageSize: 25, total: 0, totalPages: 0 },
      },
    };

    renderSettings(true);

    expect(screen.getByRole("heading", { name: "Eventos" })).toBeVisible();
    expect(screen.getByText("Sin eventos legales")).toBeVisible();
    expect(
      screen.queryByText("Aún no hay eventos legales."),
    ).not.toBeInTheDocument();
  });

  test("presents legal events without repeating their fixed type", () => {
    renderSettings(true);

    expect(screen.getByText("Audiencia de vista")).toBeVisible();
    expect(screen.getByText("18 ago 2026")).toMatchObject({
      tagName: "TIME",
    });
    expect(screen.getByText("18 ago 2026")).toHaveAttribute(
      "datetime",
      "2026-08-18",
    );
    expect(screen.queryByText("Evento legal")).not.toBeInTheDocument();
  });

  test("creates a legal event and refreshes every view that displays it", async () => {
    mocks.query = {
      ...mocks.query,
      data: {
        events: [],
        pagination: { page: 1, pageSize: 100, total: 0, totalPages: 0 },
      },
    };
    const { client } = renderSettings();
    const invalidate = vi.spyOn(client, "invalidateQueries");

    fireEvent.click(
      screen.getByRole("button", { name: "Añadir evento legal" }),
    );
    fireEvent.change(screen.getByLabelText("Nombre"), {
      target: { value: "Audiencia de vista" },
    });
    fireEvent.click(screen.getByLabelText("Fecha"));
    fireEvent.click(
      screen.getByRole("button", { name: /18 de agosto de 2026/i }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Crear evento" }));

    await waitFor(() =>
      expect(mocks.create).toHaveBeenCalledWith({
        projectId: "project-1",
        data: {
          title: "Audiencia de vista",
          type: "legal",
          date: "2026-08-18",
          description: null,
        },
      }),
    );
    expect(
      invalidate.mock.calls.map(([options]) => options?.queryKey?.[0]),
    ).toEqual(
      expect.arrayContaining([
        "/api/projects/project-1/events",
        "/api/projects/project-1/task-schedule",
        "/api/project-tasks/calendar",
        "/api/projects/project-1/activities",
      ]),
    );
    expect(
      invalidate.mock.calls.map(([options]) => options?.queryKey?.[0]),
    ).not.toContain("/api/dashboard/overview");
  });

  test("navigates every page of legal events", () => {
    mocks.query = {
      ...mocks.query,
      data: {
        events: [legalEvent],
        pagination: { page: 1, pageSize: 25, total: 30, totalPages: 2 },
      },
    };
    renderSettings();

    expect(screen.getByText("Página 1 de 2")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Siguiente" }));

    expect(mocks.list).toHaveBeenLastCalledWith("project-1", {
      page: 2,
      pageSize: 25,
    });
  });

  test("returns to the previous page after deleting its final event", async () => {
    mocks.query = {
      ...mocks.query,
      data: {
        events: [legalEvent],
        pagination: { page: 2, pageSize: 25, total: 26, totalPages: 2 },
      },
    };
    renderSettings();
    fireEvent.click(screen.getByRole("button", { name: "Siguiente" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Eliminar Audiencia de vista" }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Confirmar eliminación" }),
    );

    await waitFor(() =>
      expect(mocks.list).toHaveBeenLastCalledWith("project-1", {
        page: 1,
        pageSize: 25,
      }),
    );
  });

  test("edits an existing legal event", async () => {
    renderSettings();
    fireEvent.click(
      screen.getByRole("button", { name: "Editar Audiencia de vista" }),
    );
    fireEvent.change(screen.getByLabelText("Nombre"), {
      target: { value: "Audiencia final" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));

    await waitFor(() =>
      expect(mocks.update).toHaveBeenCalledWith({
        projectId: "project-1",
        eventId: "event-1",
        data: expect.objectContaining({
          title: "Audiencia final",
          type: "legal",
        }),
      }),
    );
  });

  test("uses an inline confirmation and keeps read-only project events immutable", async () => {
    const { rerender, client } = renderSettings();
    fireEvent.click(
      screen.getByRole("button", { name: "Eliminar Audiencia de vista" }),
    );
    expect(screen.getByText("¿Eliminar este evento legal?")).toBeVisible();
    fireEvent.click(
      screen.getByRole("button", { name: "Confirmar eliminación" }),
    );
    await waitFor(() =>
      expect(mocks.remove).toHaveBeenCalledWith({
        projectId: "project-1",
        eventId: "event-1",
      }),
    );

    rerender(
      <QueryClientProvider client={client}>
        <ProjectEventsSettings
          projectId="project-1"
          projectStartDate="2026-08-06"
          readOnly
        />
      </QueryClientProvider>,
    );
    expect(
      screen.queryByRole("button", { name: /Editar|Eliminar|Añadir/ }),
    ).not.toBeInTheDocument();
  });
});
