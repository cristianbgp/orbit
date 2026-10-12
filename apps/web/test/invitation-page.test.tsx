import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { InvitationPage } from "@/features/invitations/invitation-page";

const mocks = vi.hoisted(() => ({
  getInvitation: vi.fn(),
  acceptInvitation: vi.fn(),
}));

vi.mock("@/lib/auth-client", () => ({
  authClient: {
    organization: {
      getInvitation: mocks.getInvitation,
      acceptInvitation: mocks.acceptInvitation,
    },
  },
}));

const invitation = {
  id: "invitation-1",
  organizationId: "org-1",
  organizationName: "Estudio Orbit",
  organizationSlug: "orbit",
  email: "member@orbit.pe",
  inviterId: "user-owner",
  inviterEmail: "owner@orbit.pe",
  role: "member",
  status: "pending",
  createdAt: new Date("2026-08-06T12:00:00.000Z"),
  expiresAt: new Date("2026-08-08T12:00:00.000Z"),
};

function renderPage({
  onSignOut = vi.fn().mockResolvedValue(undefined),
}: {
  onSignOut?: () => Promise<void>;
} = {}) {
  const refreshSession = vi.fn().mockResolvedValue(undefined);
  render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <MemoryRouter initialEntries={["/invitations/invitation-1"]}>
        <Routes>
          <Route
            path="/invitations/:id"
            element={
              <InvitationPage
                invitationId="invitation-1"
                userEmail="signed-in@orbit.pe"
                refreshSession={refreshSession}
                onSignOut={onSignOut}
              />
            }
          />
          <Route path="/projects" element={<p>Proyectos</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return { refreshSession, onSignOut };
}

describe("InvitationPage", () => {
  beforeEach(() => {
    mocks.getInvitation.mockReset().mockResolvedValue({
      data: invitation,
      error: null,
    });
    mocks.acceptInvitation.mockReset().mockResolvedValue({
      data: { invitation },
      error: null,
    });
  });

  test("shows authenticated invitation details and accepts only explicitly", async () => {
    const { refreshSession } = renderPage();

    expect(screen.getByLabelText("Cargando invitación")).toBeInTheDocument();
    expect(screen.getByText("signed-in@orbit.pe")).toBeVisible();
    expect(await screen.findByText("Estudio Orbit")).toBeInTheDocument();
    expect(screen.getByText("signed-in@orbit.pe")).toBeVisible();
    expect(screen.getByText("member@orbit.pe")).toBeInTheDocument();
    expect(screen.getByText("owner@orbit.pe")).toBeInTheDocument();
    expect(mocks.acceptInvitation).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Unirme al estudio" }));
    await waitFor(() =>
      expect(mocks.acceptInvitation).toHaveBeenCalledWith({
        invitationId: "invitation-1",
      }),
    );
    expect(refreshSession).toHaveBeenCalledOnce();
    expect(await screen.findByText("Proyectos")).toBeInTheDocument();
  });

  test("offers sign out when the authenticated account does not match", async () => {
    mocks.getInvitation.mockResolvedValue({
      data: null,
      error: { code: "YOU_ARE_NOT_THE_RECIPIENT_OF_THE_INVITATION" },
    });
    const { onSignOut } = renderPage();

    expect(
      await screen.findByText("Esta invitación corresponde a otra cuenta"),
    ).toBeInTheDocument();
    expect(screen.getByText("signed-in@orbit.pe")).toBeVisible();
    expect(screen.queryByText("member@orbit.pe")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Cerrar sesión" }));
    expect(onSignOut).toHaveBeenCalledOnce();
  });

  test("keeps account controls on generic invitation errors", async () => {
    mocks.getInvitation.mockResolvedValue({
      data: null,
      error: { code: "INVITATION_NOT_FOUND" },
    });
    renderPage();

    expect(
      await screen.findByText("Esta invitación no está disponible"),
    ).toBeInTheDocument();
    expect(screen.getByText("signed-in@orbit.pe")).toBeVisible();
    expect(screen.getByRole("button", { name: "Cerrar sesión" })).toBeEnabled();
  });

  test("shares pending and recoverable sign-out state with Use another account", async () => {
    let rejectSignOut: ((error: Error) => void) | undefined;
    const onSignOut = vi.fn(
      () =>
        new Promise<void>((_resolve, reject) => {
          rejectSignOut = reject;
        }),
    );
    renderPage({ onSignOut });

    fireEvent.click(
      await screen.findByRole("button", { name: "Usar otra cuenta" }),
    );

    expect(
      await screen.findAllByRole("button", { name: "Cerrando sesión…" }),
    ).toHaveLength(2);
    expect(onSignOut).toHaveBeenCalledOnce();

    rejectSignOut?.(new Error("offline"));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "No pudimos cerrar la sesión. Inténtalo nuevamente.",
    );
    expect(
      screen.getByRole("button", { name: "Usar otra cuenta" }),
    ).toBeEnabled();
  });

  test("keeps the invitation available after the one-studio policy rejects acceptance", async () => {
    mocks.acceptInvitation.mockResolvedValue({
      data: null,
      error: { code: "ORGANIZATION_MEMBERSHIP_EXISTS" },
    });
    renderPage();

    fireEvent.click(
      await screen.findByRole("button", { name: "Unirme al estudio" }),
    );
    expect(
      await screen.findByText("Esta cuenta ya pertenece a un estudio"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Unirme al estudio" }),
    ).toBeInTheDocument();
  });
});
