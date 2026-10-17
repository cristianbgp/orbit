import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Navigate, Route, Routes } from "react-router-dom";
import { describe, expect, test, vi } from "vitest";

import {
  OrganizationGuard,
  type OrganizationGuardState,
} from "@/features/organization/organization-guard";
import type { PreAppAccountControls } from "@/features/auth/pre-app-account-controls";
import { useOrganizationCalendar } from "@/features/organization/organization-calendar-context";

function CalendarProbe() {
  const { timeZone } = useOrganizationCalendar();
  return <p>Zona del estudio: {timeZone}</p>;
}

function accountControls(): PreAppAccountControls {
  return {
    email: "ana@orbit.pe",
    signOut: vi.fn().mockResolvedValue(undefined),
    isSigningOut: false,
    signOutError: null,
  };
}

function renderGuard({
  initialPath = "/",
  state,
  activate = vi.fn().mockResolvedValue(undefined),
  retry = vi.fn(),
}: {
  initialPath?: string;
  state: OrganizationGuardState;
  activate?: (organizationId: string) => Promise<void>;
  retry?: () => void;
}) {
  render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route
          element={
            <OrganizationGuard
              state={state}
              activate={activate}
              retry={retry}
              account={accountControls()}
            />
          }
        >
          <Route path="/" element={<Navigate to="/projects" replace />} />
          <Route path="/projects" element={<p>Proyectos</p>} />
          <Route path="/calendar" element={<CalendarProbe />} />
          <Route
            path="/onboarding/organization"
            element={<p>Página de onboarding</p>}
          />
          <Route
            path="/onboarding/invitations"
            element={<p>Invitaciones pendientes</p>}
          />
        </Route>
      </Routes>
    </MemoryRouter>,
  );

  return { activate, retry };
}

describe("OrganizationGuard", () => {
  test("shows a stable loading state", () => {
    renderGuard({ state: { status: "loading" } });

    expect(screen.getByText("Preparando tu estudio")).toBeInTheDocument();
    expect(
      screen.getByRole("status", { name: "Preparando tu estudio" }),
    ).toHaveAttribute("data-slot", "pre-app-status-screen");
    expect(screen.getByText("ana@orbit.pe")).toBeVisible();
    expect(screen.queryByText("Proyectos")).not.toBeInTheDocument();
  });

  test("delegates onboarding selection when the user has no membership", async () => {
    renderGuard({
      state: {
        status: "ready",
        organizations: [],
        activeOrganizationId: null,
      },
    });

    expect(await screen.findByText("Proyectos")).toBeInTheDocument();
  });

  test("redirects a member away from onboarding", async () => {
    renderGuard({
      initialPath: "/onboarding/organization",
      state: {
        status: "ready",
        organizations: [
          { id: "org-1", name: "Orbit", timeZone: "America/Lima" },
        ],
        activeOrganizationId: "org-1",
      },
    });

    expect(await screen.findByText("Proyectos")).toBeInTheDocument();
  });

  test("redirects a member away from invitation onboarding", async () => {
    renderGuard({
      initialPath: "/onboarding/invitations",
      state: {
        status: "ready",
        organizations: [
          { id: "org-1", name: "Orbit", timeZone: "America/Lima" },
        ],
        activeOrganizationId: "org-1",
      },
    });

    expect(await screen.findByText("Proyectos")).toBeInTheDocument();
  });

  test("activates a deterministic fallback before rendering the app", async () => {
    const activate = vi.fn().mockResolvedValue(undefined);
    renderGuard({
      state: {
        status: "ready",
        organizations: [
          { id: "org-b", name: "Beta", timeZone: "UTC" },
          { id: "org-a", name: "Alpha", timeZone: "America/Lima" },
        ],
        activeOrganizationId: null,
      },
      activate,
    });

    expect(screen.getByText("Preparando tu estudio")).toBeInTheDocument();
    expect(screen.queryByText("Proyectos")).not.toBeInTheDocument();
    await waitFor(() => expect(activate).toHaveBeenCalledWith("org-a"));
    expect(await screen.findByText("Proyectos")).toBeInTheDocument();
  });

  test("renders a retryable lookup error without redirecting", () => {
    const retry = vi.fn();
    renderGuard({ state: { status: "error" }, retry });

    expect(
      screen.getByText("No pudimos comprobar tu estudio"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("alert", {
        name: "No pudimos comprobar tu estudio",
      }),
    ).toHaveAttribute("data-slot", "pre-app-status-screen");
    expect(screen.getByText("ana@orbit.pe")).toBeVisible();
    expect(screen.queryByText("Página de onboarding")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Intentar de nuevo" }));
    expect(retry).toHaveBeenCalledOnce();
  });

  test("turns activation failure into a retryable error", async () => {
    const activate = vi.fn().mockRejectedValue(new Error("offline"));
    renderGuard({
      state: {
        status: "ready",
        organizations: [
          { id: "org-1", name: "Orbit", timeZone: "America/Lima" },
        ],
        activeOrganizationId: null,
      },
      activate,
    });

    expect(
      await screen.findByText("No pudimos abrir tu estudio"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("alert", { name: "No pudimos abrir tu estudio" }),
    ).toHaveAttribute("data-slot", "pre-app-status-screen");
    expect(screen.getByText("ana@orbit.pe")).toBeVisible();
    expect(screen.queryByText("Proyectos")).not.toBeInTheDocument();
  });

  test("provides the selected organization's calendar to the app", async () => {
    renderGuard({
      initialPath: "/calendar",
      state: {
        status: "ready",
        organizations: [
          { id: "org-1", name: "Orbit", timeZone: "America/Lima" },
        ],
        activeOrganizationId: "org-1",
      },
    });

    expect(
      await screen.findByText("Zona del estudio: America/Lima"),
    ).toBeInTheDocument();
  });
});
