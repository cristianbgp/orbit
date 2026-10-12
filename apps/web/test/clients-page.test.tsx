import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { ClientsPage } from "@/features/clients/clients-page";

const mocks = vi.hoisted(() => ({
  query: {
    data: undefined as
      | undefined
      | {
          clients: Array<Record<string, unknown>>;
          pagination: {
            page: number;
            pageSize: number;
            total: number;
            totalPages: number;
          };
        },
    isPending: false,
    isError: false,
    isPlaceholderData: false,
    refetch: vi.fn(),
  },
  create: vi.fn(),
  update: vi.fn(),
  lastParams: undefined as unknown,
  lastClientId: undefined as string | undefined,
  detail: {
    data: undefined as undefined | { client: Record<string, unknown> },
    isPending: false,
    isError: false,
    refetch: vi.fn(),
  },
}));

vi.mock("@/lib/api/generated/clients/clients", () => ({
  getListClientsQueryKey: () => ["/api/clients"],
  useListClients: (params: unknown) => {
    mocks.lastParams = params;
    return mocks.query;
  },
  useCreateClient: () => ({ mutateAsync: mocks.create, isPending: false }),
  useUpdateClient: () => ({ mutateAsync: mocks.update, isPending: false }),
  useGetClient: (
    clientId: string,
    options: { query?: { enabled?: boolean } },
  ) => {
    mocks.lastClientId = options.query?.enabled ? clientId : undefined;
    return mocks.detail;
  },
}));

function renderPage(initialEntry = "/clients") {
  return render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <MemoryRouter initialEntries={[initialEntry]}>
        <ClientsPage />
        <LocationProbe />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

function LocationProbe() {
  const location = useLocation();
  return (
    <output aria-label="Ruta actual">
      {location.pathname}
      {location.search}
    </output>
  );
}

const company = {
  id: "client-1",
  type: "company",
  name: "Constructora del Sur S.A.",
  documentType: "RUC",
  documentNumber: "20123456789",
  email: "legal@constructora.pe",
  phone: null,
  address: null,
  notes: null,
  createdAt: "2026-08-05T10:00:00.000Z",
  updatedAt: "2026-08-05T10:00:00.000Z",
};

describe("ClientsPage", () => {
  beforeEach(() => {
    mocks.query.data = {
      clients: [],
      pagination: { page: 1, pageSize: 25, total: 0, totalPages: 0 },
    };
    mocks.query.isPending = false;
    mocks.query.isError = false;
    mocks.query.isPlaceholderData = false;
    mocks.query.refetch.mockReset().mockResolvedValue(undefined);
    mocks.create.mockReset().mockResolvedValue({ client: company });
    mocks.update.mockReset().mockResolvedValue({ client: company });
    mocks.lastParams = undefined;
    mocks.lastClientId = undefined;
    mocks.detail.data = { client: company };
    mocks.detail.isPending = false;
    mocks.detail.isError = false;
    mocks.detail.refetch.mockReset().mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test("uses the shared application page frame", () => {
    renderPage();

    const heading = screen.getByRole("heading", { name: "Clientes" });
    expect(heading.closest('[data-slot="app-page"]')).toHaveClass(
      "max-w-384",
      "py-6",
      "lg:py-8",
    );
    expect(
      heading
        .closest('[data-slot="app-page-header"]')
        ?.querySelector("svg.lucide-building-2"),
    ).toHaveAttribute("aria-hidden", "true");
    expect(
      heading.closest('[data-slot="app-page-header"]')?.nextElementSibling,
    ).toHaveAttribute("data-slot", "app-page-content");
  });

  test("uses a compact split layout at iPad widths and expands it on wide desktops", () => {
    renderPage();

    const contentGrid = screen
      .getByRole("heading", { name: "Todos los clientes" })
      .closest(".grid");

    expect(contentGrid).toHaveClass(
      "lg:grid-cols-[minmax(15rem,0.8fr)_minmax(20rem,1.2fr)]",
      "xl:grid-cols-[minmax(19rem,0.84fr)_minmax(28rem,1.16fr)]",
    );
  });

  test("renders list-shaped loading feedback", () => {
    mocks.query.isPending = true;
    mocks.query.data = undefined;
    renderPage();

    expect(screen.getByLabelText("Cargando clientes")).toBeInTheDocument();
  });

  test("renders a recoverable list error", () => {
    mocks.query.isError = true;
    mocks.query.data = undefined;
    renderPage();

    expect(
      screen.getByText("No pudimos cargar tus clientes"),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Intentar de nuevo" }));
    expect(mocks.query.refetch).toHaveBeenCalledOnce();
  });

  test("guides an empty Estudio into client creation", () => {
    renderPage();

    expect(screen.getByText("Tu directorio empieza aquí")).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: "Crear primer cliente" }),
    );
    expect(
      screen.getByRole("heading", { name: "Nuevo cliente" }),
    ).toBeInTheDocument();
  });

  test("opens and closes client creation through action=create", () => {
    renderPage("/clients?source=command&action=create");

    expect(
      screen.getByRole("heading", { name: "Nuevo cliente" }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Cerrar" }));
    expect(screen.getByLabelText("Ruta actual")).toHaveTextContent(
      "/clients?source=command",
    );
  });

  test("loads a URL-selected client and preserves unrelated parameters", () => {
    renderPage("/clients?source=command&client=client-1");

    expect(mocks.lastClientId).toBe("client-1");
    expect(
      screen.getByRole("heading", { name: "Editar cliente" }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Cerrar" }));
    expect(screen.getByLabelText("Ruta actual")).toHaveTextContent(
      "/clients?source=command",
    );
  });

  test("shows a recoverable error for an unavailable URL-selected client", () => {
    mocks.detail.data = undefined;
    mocks.detail.isError = true;
    renderPage("/clients?client=missing");

    expect(
      screen.getByText("No pudimos cargar este cliente"),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Intentar de nuevo" }));
    expect(mocks.detail.refetch).toHaveBeenCalledOnce();
  });

  test("replaces creation action with the created client selection", async () => {
    renderPage("/clients?source=command&action=create");

    fireEvent.change(screen.getByLabelText("Nombre completo"), {
      target: { value: "Constructora del Sur" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Crear cliente" }));
    await waitFor(() =>
      expect(screen.getByLabelText("Ruta actual")).toHaveTextContent(
        "/clients?source=command&client=client-1",
      ),
    );
  });

  test("selects and edits an existing client", async () => {
    mocks.query.data = {
      clients: [company],
      pagination: { page: 1, pageSize: 25, total: 1, totalPages: 1 },
    };
    renderPage();

    fireEvent.click(
      screen.getByRole("button", { name: /Constructora del Sur/ }),
    );
    expect(screen.getByLabelText("Ruta actual")).toHaveTextContent(
      "/clients?client=client-1",
    );
    expect(
      screen.getByRole("heading", { name: "Editar cliente" }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
    await waitFor(() => expect(mocks.update).toHaveBeenCalled());
  });

  test("shows server totals and requests the next page", () => {
    mocks.query.data = {
      clients: [company],
      pagination: { page: 1, pageSize: 25, total: 52, totalPages: 3 },
    };
    renderPage();

    expect(screen.getByText("52 registros")).toBeInTheDocument();
    expect(screen.getByText("Página 1 de 3")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Anterior" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Siguiente" })).toBeEnabled();

    fireEvent.click(screen.getByRole("button", { name: "Siguiente" }));
    expect(mocks.lastParams).toEqual({ page: 2, pageSize: 25 });
  });

  test("debounces search and immediately returns to the first page", () => {
    vi.useFakeTimers();
    mocks.query.data = {
      clients: [company],
      pagination: { page: 1, pageSize: 25, total: 52, totalPages: 3 },
    };
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Siguiente" }));
    expect(mocks.lastParams).toEqual({ page: 2, pageSize: 25 });

    fireEvent.change(screen.getByLabelText("Buscar clientes"), {
      target: { value: "Constructora" },
    });
    expect(mocks.lastParams).toEqual({ page: 1, pageSize: 25 });

    act(() => vi.advanceTimersByTime(299));
    expect(mocks.lastParams).toEqual({ page: 1, pageSize: 25 });

    act(() => vi.advanceTimersByTime(1));
    expect(mocks.lastParams).toEqual({
      search: "Constructora",
      page: 1,
      pageSize: 25,
    });
  });
});
