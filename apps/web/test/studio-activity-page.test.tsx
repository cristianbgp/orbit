import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { StudioActivityPage } from "@/features/activity/studio-activity-page";
import { dashboardActivityFixture } from "./support/dashboard-activity";

const mocks = vi.hoisted(() => ({
  listActivity: vi.fn(),
}));

vi.mock("@/lib/api/generated/dashboard/dashboard", async (importOriginal) => ({
  ...(await importOriginal<
    typeof import("@/lib/api/generated/dashboard/dashboard")
  >()),
  listDashboardActivity: mocks.listActivity,
}));

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <StudioActivityPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("StudioActivityPage", () => {
  beforeEach(() => {
    mocks.listActivity.mockReset();
  });

  test("renders a responsive initial loading state", () => {
    mocks.listActivity.mockReturnValue(new Promise(() => undefined));

    renderPage();

    const heading = screen.getByRole("heading", { name: "Actividad" });
    expect(heading).toBeVisible();
    expect(heading.closest('[data-slot="app-page"]')).toHaveClass(
      "py-6",
      "lg:py-8",
    );
    expect(
      heading
        .closest('[data-slot="app-page-header"]')
        ?.querySelector("svg.lucide-activity"),
    ).toHaveAttribute("aria-hidden", "true");
    expect(
      heading.closest('[data-slot="app-page-header"]')?.nextElementSibling,
    ).toHaveAttribute("data-slot", "app-page-content");
    expect(
      screen.getByLabelText("Cargando actividad del estudio"),
    ).toBeVisible();
  });

  test("renders a recoverable initial error", async () => {
    mocks.listActivity.mockRejectedValueOnce(new Error("offline"));

    renderPage();

    expect(
      await screen.findByText("No pudimos cargar la actividad del estudio."),
    ).toBeVisible();
    mocks.listActivity.mockResolvedValueOnce({
      timeZone: "America/Lima",
      activities: [],
      nextCursor: null,
    });
    fireEvent.click(screen.getByRole("button", { name: "Intentar de nuevo" }));
    expect(
      await screen.findByText("Todavía no hay actividad en el estudio."),
    ).toBeVisible();
  });

  test("loads and appends an older activity page", async () => {
    mocks.listActivity
      .mockResolvedValueOnce({
        timeZone: "America/Lima",
        activities: [dashboardActivityFixture[0]],
        nextCursor: "older-page",
      })
      .mockResolvedValueOnce({
        timeZone: "America/Lima",
        activities: [dashboardActivityFixture[1]],
        nextCursor: null,
      });

    renderPage();

    expect(await screen.findByText("Apelación Constructora")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Cargar más" }));

    expect(await screen.findByText("Proyecto archivado")).toBeVisible();
    expect(mocks.listActivity).toHaveBeenNthCalledWith(
      2,
      { pageSize: 25, cursor: "older-page" },
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    expect(screen.queryByRole("button", { name: "Cargar más" })).toBeNull();
  });

  test("retains loaded activity when loading more fails and can retry", async () => {
    mocks.listActivity
      .mockResolvedValueOnce({
        timeZone: "America/Lima",
        activities: [dashboardActivityFixture[0]],
        nextCursor: "older-page",
      })
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce({
        timeZone: "America/Lima",
        activities: [dashboardActivityFixture[1]],
        nextCursor: null,
      });

    renderPage();
    expect(await screen.findByText("Apelación Constructora")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Cargar más" }));

    expect(
      await screen.findByText("No pudimos cargar más actividad."),
    ).toBeVisible();
    expect(screen.getByText("Apelación Constructora")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));

    await waitFor(() =>
      expect(screen.getByText("Proyecto archivado")).toBeVisible(),
    );
  });
});
