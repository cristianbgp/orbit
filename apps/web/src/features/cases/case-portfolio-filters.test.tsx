import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";

import { CasePortfolioFiltersBar } from "./case-portfolio-filters";
import type { CasePortfolioFilters } from "./case-portfolio-filter-state";

Element.prototype.scrollIntoView = vi.fn();
globalThis.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

vi.mock("@/hooks/use-compact-filters", () => ({
  useCompactFilters: () => false,
}));

vi.mock("./use-case-option-pages", () => ({
  useAllCaseClients: () => ({
    data: [{ id: "client-1", name: "Cliente de prueba" }],
  }),
  useAllCaseMembers: () => ({
    data: [
      {
        userId: "user-1",
        alias: "AT",
        name: "Ana Torres",
      },
    ],
  }),
}));

const emptyFilters: CasePortfolioFilters = {
  types: [],
  clientIds: [],
  memberUserIds: [],
};

describe("CasePortfolioFiltersBar", () => {
  test("adds more than one case type from the compact filter", () => {
    const onFiltersChange = vi.fn();
    const { rerender } = render(
      <CasePortfolioFiltersBar
        search=""
        filters={{ ...emptyFilters, types: [] }}
        onSearchChange={vi.fn()}
        onFiltersChange={onFiltersChange}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Filtrar casos" }));
    fireEvent.click(screen.getByText("Tipo"));
    fireEvent.click(screen.getByText("Administrativo"));
    expect(onFiltersChange).toHaveBeenLastCalledWith({
      ...emptyFilters,
      types: ["administrative"],
    });

    rerender(
      <CasePortfolioFiltersBar
        search=""
        filters={{ ...emptyFilters, types: ["administrative"] }}
        onSearchChange={vi.fn()}
        onFiltersChange={onFiltersChange}
      />,
    );
    fireEvent.click(screen.getByText("Judicial"));
    expect(onFiltersChange).toHaveBeenLastCalledWith({
      ...emptyFilters,
      types: ["administrative", "judicial"],
    });
  });

  test("exposes client and member as filter properties", () => {
    render(
      <CasePortfolioFiltersBar
        search=""
        filters={{ ...emptyFilters, types: [] }}
        onSearchChange={vi.fn()}
        onFiltersChange={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Filtrar casos" }));
    expect(screen.getByText("Cliente")).toBeInTheDocument();
    expect(screen.getByText("Miembro")).toBeInTheDocument();
  });
});
