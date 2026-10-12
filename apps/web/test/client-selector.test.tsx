import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { ClientSelector } from "@/features/projects/client-selector";

Element.prototype.scrollIntoView = vi.fn();
vi.stubGlobal(
  "ResizeObserver",
  class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
);

const client = {
  id: "client-1",
  type: "company" as const,
  name: "Construcciones del Sur S.A.",
  documentType: "RUC",
  documentNumber: "20123456789",
  email: null,
  phone: null,
  address: null,
  notes: null,
  createdAt: "2026-08-06T10:00:00.000Z",
  updatedAt: "2026-08-06T10:00:00.000Z",
};

const mocks = vi.hoisted(() => ({
  params: undefined as unknown,
  query: {
    data: undefined as
      | undefined
      | {
          clients: (typeof client)[];
          pagination: {
            page: number;
            pageSize: number;
            total: number;
            totalPages: number;
          };
        },
    isPending: false,
    isError: false,
    refetch: vi.fn(),
  },
}));

vi.mock("@/lib/api/generated/clients/clients", () => ({
  useListClients: (params: unknown) => {
    mocks.params = params;
    return mocks.query;
  },
}));

describe("ClientSelector", () => {
  beforeEach(() => {
    mocks.params = undefined;
    mocks.query.data = {
      clients: [client],
      pagination: { page: 1, pageSize: 25, total: 1, totalPages: 1 },
    };
    mocks.query.isPending = false;
    mocks.query.isError = false;
    mocks.query.refetch.mockReset().mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test("queries a bounded client list and selects a result", () => {
    const onChange = vi.fn();
    render(<ClientSelector value={null} onChange={onChange} />);

    expect(mocks.params).toEqual({ page: 1, pageSize: 25 });
    fireEvent.click(screen.getByRole("combobox"));
    fireEvent.click(
      screen.getByRole("option", { name: /Construcciones del Sur/ }),
    );
    expect(onChange).toHaveBeenCalledWith({
      id: "client-1",
      name: "Construcciones del Sur S.A.",
    });
  });

  test("debounces client search by 300 milliseconds", () => {
    vi.useFakeTimers();
    render(<ClientSelector value={null} onChange={vi.fn()} />);

    fireEvent.click(screen.getByRole("combobox"));
    fireEvent.change(screen.getByLabelText("Buscar cliente"), {
      target: { value: "Andina" },
    });
    act(() => vi.advanceTimersByTime(299));
    expect(mocks.params).toEqual({ page: 1, pageSize: 25 });

    act(() => vi.advanceTimersByTime(1));
    expect(mocks.params).toEqual({
      search: "Andina",
      page: 1,
      pageSize: 25,
    });
  });

  test("keeps the selected client visible outside current results", () => {
    mocks.query.data = {
      clients: [],
      pagination: { page: 1, pageSize: 25, total: 0, totalPages: 0 },
    };

    render(
      <ClientSelector
        value={{ id: "client-2", name: "Inversiones Andina" }}
        onChange={vi.fn()}
      />,
    );

    expect(screen.getByText("Inversiones Andina")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("combobox"));
    expect(screen.getByText("No encontramos clientes.")).toBeInTheDocument();
  });

  test("shows loading and a recoverable error", () => {
    mocks.query.isPending = true;
    mocks.query.data = undefined;
    const { rerender } = render(
      <ClientSelector value={null} onChange={vi.fn()} />,
    );
    fireEvent.click(screen.getByRole("combobox"));
    expect(screen.getByText("Buscando clientes…")).toBeInTheDocument();

    mocks.query.isPending = false;
    mocks.query.isError = true;
    rerender(<ClientSelector value={null} onChange={vi.fn()} />);
    expect(screen.getByText("No pudimos buscar clientes.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Intentar de nuevo" }));
    expect(mocks.query.refetch).toHaveBeenCalledOnce();
  });
});
