import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, test, vi } from "vitest";

import {
  InvitationOnboardingGuard,
  type InvitationOnboardingGuardState,
} from "@/features/invitations/invitation-onboarding-guard";
import type { PreAppAccountControls } from "@/features/auth/pre-app-account-controls";

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
  retry = vi.fn(),
}: {
  initialPath?: string;
  state: InvitationOnboardingGuardState;
  retry?: () => void;
}) {
  render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route
          element={
            <InvitationOnboardingGuard
              state={state}
              retry={retry}
              account={accountControls()}
            />
          }
        >
          <Route path="/" element={<p>Aplicación principal</p>} />
          <Route
            path="/onboarding/invitations"
            element={<p>Decidir invitaciones</p>}
          />
          <Route
            path="/onboarding/organization"
            element={<p>Crear organización</p>}
          />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
  return { retry };
}

describe("InvitationOnboardingGuard", () => {
  test("leaves routing unchanged when invitation onboarding is inactive", () => {
    renderGuard({ state: { status: "inactive" } });

    expect(screen.getByText("Aplicación principal")).toBeInTheDocument();
  });

  test("redirects active recipients away from organization creation", async () => {
    renderGuard({
      initialPath: "/onboarding/organization",
      state: { status: "ready", activeInvitationCount: 1 },
    });

    expect(await screen.findByText("Decidir invitaciones")).toBeInTheDocument();
    expect(screen.queryByText("Crear organización")).not.toBeInTheDocument();
  });

  test("redirects users without active invitations to organization creation", async () => {
    renderGuard({
      initialPath: "/onboarding/invitations",
      state: { status: "ready", activeInvitationCount: 0 },
    });

    expect(await screen.findByText("Crear organización")).toBeInTheDocument();
    expect(screen.queryByText("Decidir invitaciones")).not.toBeInTheDocument();
  });

  test("holds both onboarding pages while invitations are loading", () => {
    renderGuard({
      initialPath: "/onboarding/organization",
      state: { status: "loading" },
    });

    expect(
      screen.getByText("Comprobando tus invitaciones"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("status", { name: "Comprobando tus invitaciones" }),
    ).toHaveAttribute("data-slot", "pre-app-status-screen");
    expect(screen.getByText("ana@orbit.pe")).toBeVisible();
    expect(screen.queryByText("Crear organización")).not.toBeInTheDocument();
    expect(screen.queryByText("Decidir invitaciones")).not.toBeInTheDocument();
  });

  test("offers retry without assuming a failed lookup is empty", () => {
    const { retry } = renderGuard({ state: { status: "error" } });

    expect(
      screen.getByText("No pudimos comprobar tus invitaciones"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("alert", {
        name: "No pudimos comprobar tus invitaciones",
      }),
    ).toHaveAttribute("data-slot", "pre-app-status-screen");
    expect(screen.getByText("ana@orbit.pe")).toBeVisible();
    expect(screen.queryByText("Crear organización")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Intentar de nuevo" }));
    expect(retry).toHaveBeenCalledOnce();
  });
});
