import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { describe, expect, test, vi } from "vitest";

import { ProjectCreatePage } from "@/features/projects/project-create-page";

const mocks = vi.hoisted(() => ({ mutateAsync: vi.fn() }));

vi.mock("@/lib/api/generated/projects/projects", () => ({
  getListProjectsQueryKey: () => ["/api/projects"],
  getListProjectsGroupedByClientQueryKey: () => [
    "/api/projects/grouped-by-client",
  ],
  useCreateProject: () => ({ mutateAsync: mocks.mutateAsync }),
}));

vi.mock("@/features/projects/project-form", () => ({
  ProjectForm: ({
    onSubmit,
    onCancel,
  }: {
    onSubmit(input: unknown): void;
    onCancel(): void;
  }) => (
    <div>
      <button type="button" onClick={() => onSubmit({ name: "Proyecto" })}>
        Enviar formulario
      </button>
      <button type="button" onClick={onCancel}>
        Cancelar
      </button>
    </div>
  ),
}));

function Location() {
  return <output aria-label="Ruta actual">{useLocation().pathname}</output>;
}

function renderPage({ invalidationFails = false } = {}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  if (invalidationFails) {
    vi.spyOn(queryClient, "invalidateQueries").mockRejectedValue(
      new Error("refresh failed"),
    );
  }
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/projects/new"]}>
        <Routes>
          <Route
            path="*"
            element={
              <>
                <ProjectCreatePage />
                <Location />
              </>
            }
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("ProjectCreatePage", () => {
  test("creates the project and replaces the page with its detail", async () => {
    mocks.mutateAsync.mockResolvedValue({ project: { id: "project-1" } });
    renderPage();

    const heading = screen.getByRole("heading", { name: "Nuevo proyecto" });
    expect(heading).toBeInTheDocument();
    const content = heading.closest(
      '[data-slot="app-page-header"]',
    )?.parentElement;
    expect(content).toHaveClass("w-full", "max-w-4xl");
    expect(content).not.toHaveClass("mx-auto");
    expect(content?.closest('[data-slot="app-page"]')).toHaveClass("max-w-384");
    expect(heading).toHaveClass("font-display", "text-3xl", "sm:text-4xl");
    expect(
      heading
        .closest('[data-slot="app-page-header"]')
        ?.querySelector("svg.lucide-folder-kanban"),
    ).toHaveAttribute("aria-hidden", "true");
    expect(
      heading.closest('[data-slot="app-page-header"]')?.nextElementSibling,
    ).toHaveAttribute("data-slot", "app-page-content");
    fireEvent.click(screen.getByRole("button", { name: "Enviar formulario" }));

    await waitFor(() =>
      expect(screen.getByLabelText("Ruta actual")).toHaveTextContent(
        "/projects/project-1",
      ),
    );
    expect(mocks.mutateAsync).toHaveBeenCalledWith({
      data: { name: "Proyecto" },
    });
  });

  test("returns to the portfolio without creating", () => {
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(screen.getByLabelText("Ruta actual")).toHaveTextContent("/projects");
  });

  test("still opens the created project when list refresh fails", async () => {
    mocks.mutateAsync.mockResolvedValue({ project: { id: "project-2" } });
    renderPage({ invalidationFails: true });

    fireEvent.click(screen.getByRole("button", { name: "Enviar formulario" }));

    await waitFor(() =>
      expect(screen.getByLabelText("Ruta actual")).toHaveTextContent(
        "/projects/project-2",
      ),
    );
  });
});
