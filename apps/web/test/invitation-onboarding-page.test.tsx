import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, test, vi } from "vitest";

import { InvitationOnboardingPage } from "@/features/invitations/invitation-onboarding-page";
import type { UserInvitation } from "@/features/invitations/user-invitation-policy";
import type { PreAppAccountControls } from "@/features/auth/pre-app-account-controls";

const invitations: UserInvitation[] = [
  {
    id: "invitation-1",
    organizationName: "Estudio Orbit",
    status: "pending",
    createdAt: "2026-08-06T12:00:00.000Z",
    expiresAt: "2026-08-08T17:00:00.000Z",
  },
  {
    id: "invitation-2",
    organizationName: "Estudio Norte",
    status: "pending",
    createdAt: "2026-08-06T13:00:00.000Z",
    expiresAt: "2026-08-08T18:00:00.000Z",
  },
];

function renderPage({
  onReject = vi.fn().mockResolvedValue(undefined),
  onSignOut = vi.fn().mockResolvedValue(undefined),
}: {
  onReject?: (invitationId: string) => Promise<void>;
  onSignOut?: () => Promise<void>;
} = {}) {
  render(
    <MemoryRouter>
      <InvitationOnboardingPage
        invitations={invitations}
        onReject={onReject}
        account={
          {
            email: "member@orbit.pe",
            signOut: onSignOut,
            isSigningOut: false,
            signOutError: null,
          } satisfies PreAppAccountControls
        }
      />
    </MemoryRouter>,
  );
  return { onReject, onSignOut };
}

describe("InvitationOnboardingPage", () => {
  test("shows each studio and opens the existing invitation detail route", () => {
    renderPage();

    expect(
      screen.getByRole("heading", { name: "Invitaciones pendientes" }),
    ).toBeInTheDocument();
    expect(screen.getByText("member@orbit.pe")).toBeVisible();
    expect(screen.getByText("Estudio Orbit")).toBeInTheDocument();
    expect(screen.getByText("Estudio Norte")).toBeInTheDocument();
    expect(screen.getAllByText(/8 de agosto de 2026/)).toHaveLength(2);
    expect(
      screen.getByRole("link", { name: "Ver invitación de Estudio Orbit" }),
    ).toHaveAttribute("href", "/invitations/invitation-1");
    expect(
      screen.queryByRole("button", { name: "Unirme al estudio" }),
    ).not.toBeInTheDocument();
  });

  test("requires named confirmation before rejecting an invitation", async () => {
    const { onReject } = renderPage();

    fireEvent.click(
      screen.getByRole("button", {
        name: "Rechazar invitación de Estudio Orbit",
      }),
    );
    expect(
      screen.getByText(/necesitarás un nuevo enlace para unirte más adelante/i),
    ).toBeInTheDocument();
    expect(onReject).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Confirmar rechazo" }));
    await waitFor(() => expect(onReject).toHaveBeenCalledWith("invitation-1"));
  });

  test("returns from confirmation without changing the invitation", () => {
    const { onReject } = renderPage();

    fireEvent.click(
      screen.getByRole("button", {
        name: "Rechazar invitación de Estudio Orbit",
      }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Volver" }));

    expect(onReject).not.toHaveBeenCalled();
    expect(
      screen.queryByRole("button", { name: "Confirmar rechazo" }),
    ).not.toBeInTheDocument();
  });

  test("keeps failed rejection available for retry", async () => {
    const onReject = vi
      .fn()
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce(undefined);
    renderPage({ onReject });

    fireEvent.click(
      screen.getByRole("button", {
        name: "Rechazar invitación de Estudio Orbit",
      }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Confirmar rechazo" }));
    expect(
      await screen.findByText(
        "No pudimos rechazar la invitación. Inténtalo nuevamente.",
      ),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Confirmar rechazo" }));

    await waitFor(() => expect(onReject).toHaveBeenCalledTimes(2));
  });

  test("signs out without resolving any invitation", () => {
    const { onReject, onSignOut } = renderPage();

    fireEvent.click(screen.getByRole("button", { name: "Cerrar sesión" }));

    expect(onSignOut).toHaveBeenCalledOnce();
    expect(onReject).not.toHaveBeenCalled();
  });
});
