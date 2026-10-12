import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";

import { GlobalSearchDialog } from "./global-search-dialog";

globalThis.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};
Element.prototype.scrollIntoView = vi.fn();

const emptyData = {
  cases: [],
  projects: [],
  tasks: [],
  clients: [],
  members: [],
};

function renderDialog(overrides: Record<string, unknown> = {}) {
  const onSelect = vi.fn();
  render(
    <GlobalSearchDialog
      open
      onOpenChange={vi.fn()}
      query=""
      onQueryChange={vi.fn()}
      normalizedQuery=""
      debouncedQuery=""
      enabled={false}
      isCurrentQuery
      data={emptyData as never}
      isPending={false}
      isFetching={false}
      isError={false}
      onRetry={vi.fn()}
      onSelect={onSelect}
      helpAssistantEnabled={false}
      {...overrides}
    />,
  );
  return { onSelect };
}

describe("GlobalSearchDialog", () => {
  test("offers case creation and navigation before searching", async () => {
    const { onSelect } = renderDialog();

    fireEvent.click(screen.getByRole("option", { name: "Nuevo caso" }));
    expect(onSelect).toHaveBeenCalledWith("/cases/new");
    fireEvent.click(screen.getByRole("option", { name: "Casos" }));
    expect(onSelect).toHaveBeenCalledWith("/cases");
  });

  test("opens a matching case from its own result group", async () => {
    const { onSelect } = renderDialog({
      query: "fiscalización",
      normalizedQuery: "fiscalización",
      debouncedQuery: "fiscalización",
      enabled: true,
      data: {
        ...emptyData,
        cases: [
          {
            id: "case-1",
            identification: "Fiscalización Andina",
            status: "in_progress",
            type: "administrative",
            client: { id: "client-1", name: "Andina S.A." },
          },
        ],
      },
    });

    expect(screen.getByRole("group", { name: "Casos" })).toBeVisible();
    fireEvent.click(
      screen.getByRole("option", { name: /Fiscalización Andina/i }),
    );
    expect(onSelect).toHaveBeenCalledWith("/cases/case-1");
  });
});
