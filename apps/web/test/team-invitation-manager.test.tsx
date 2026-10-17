import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";

import {
  PendingTeamInvitations,
  TeamInvitationForm,
} from "@/features/team/team-invitation-manager";
import type { TeamInvitation } from "@/lib/api/generated/models";

Element.prototype.scrollIntoView = vi.fn();

const mocks = vi.hoisted(() => ({
  inviteMember: vi.fn(),
  cancelInvitation: vi.fn(),
  writeText: vi.fn(),
}));

vi.mock("@/lib/auth-client", () => ({
  authClient: {
    organization: {
      inviteMember: mocks.inviteMember,
      cancelInvitation: mocks.cancelInvitation,
    },
  },
}));

const invitation = {
  id: "invitation-1",
  email: "member@orbit.pe",
  role: "member" as const,
  position: "senior" as const,
  status: "pending" as const,
  createdAt: "2026-08-06T12:00:00.000Z",
  expiresAt: "2099-08-08T12:00:00.000Z",
};

function renderForm() {
  const onRefresh = vi.fn().mockResolvedValue(undefined);
  render(
    <QueryClientProvider client={new QueryClient()}>
      <TeamInvitationForm onRefresh={onRefresh} />
    </QueryClientProvider>,
  );
  return { onRefresh };
}

function renderPending(invitations: TeamInvitation[] = [invitation]) {
  const onRefresh = vi.fn().mockResolvedValue(undefined);
  render(
    <QueryClientProvider client={new QueryClient()}>
      <PendingTeamInvitations invitations={invitations} onRefresh={onRefresh} />
    </QueryClientProvider>,
  );
  return { onRefresh };
}

describe("TeamInvitationManager", () => {
  beforeEach(() => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: mocks.writeText },
    });
    mocks.writeText.mockReset().mockResolvedValue(undefined);
    mocks.inviteMember.mockReset().mockResolvedValue({
      data: { id: "invitation-new" },
      error: null,
    });
    mocks.cancelInvitation
      .mockReset()
      .mockResolvedValue({ data: null, error: null });
  });

  test("requires and sends the selected professional position", async () => {
    renderForm();

    expect(
      screen.queryByText("Invitaciones pendientes"),
    ).not.toBeInTheDocument();

    expect(screen.getByRole("combobox", { name: "Posición" })).toHaveAttribute(
      "aria-required",
      "true",
    );

    fireEvent.change(screen.getByLabelText("Correo del nuevo miembro"), {
      target: { value: "  MEMBER@ORBIT.PE " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Invitar miembro" }));

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Selecciona una posición.",
    );
    expect(mocks.inviteMember).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("combobox", { name: "Posición" }));
    fireEvent.click(screen.getByRole("option", { name: "Senior" }));
    fireEvent.click(screen.getByRole("button", { name: "Invitar miembro" }));

    await waitFor(() =>
      expect(mocks.inviteMember).toHaveBeenCalledWith({
        email: "member@orbit.pe",
        role: "member",
        position: "senior",
      }),
    );
    expect(
      await screen.findByDisplayValue(
        `${window.location.origin}/invitations/invitation-new`,
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Este enlace vence en 48 horas."),
    ).toBeInTheDocument();
  });

  test("generates a replacement link for a pending invitation", async () => {
    renderPending();

    expect(
      screen.queryByLabelText("Correo del nuevo miembro"),
    ).not.toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: "Generar nuevo enlace" }),
    );

    await waitFor(() =>
      expect(mocks.inviteMember).toHaveBeenCalledWith({
        email: "member@orbit.pe",
        role: "member",
        position: "senior",
        resend: true,
      }),
    );
    expect(screen.getAllByText("Senior").length).toBeGreaterThan(0);
  });

  test("keeps a legacy invitation visible but requires replacing it manually", () => {
    renderPending([{ ...invitation, position: null }]);

    expect(screen.getByText("Sin posición")).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: "Generar nuevo enlace" }),
    );

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Esta invitación no tiene posición. Cancélala y crea una nueva.",
    );
    expect(mocks.inviteMember).not.toHaveBeenCalled();
  });

  test("shows and copies the existing link for a pending invitation", async () => {
    renderPending();
    const link = `${window.location.origin}/invitations/invitation-1`;

    expect(screen.getByDisplayValue(link)).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", {
        name: "Copiar enlace de member@orbit.pe",
      }),
    );

    await waitFor(() => expect(mocks.writeText).toHaveBeenCalledWith(link));
    expect(screen.getByText("Enlace copiado.")).toBeInTheDocument();
  });

  test("confirms cancellation by email and refreshes only after success", async () => {
    const { onRefresh } = renderPending();

    fireEvent.click(
      screen.getByRole("button", { name: "Cancelar invitación" }),
    );
    expect(
      screen.getByText(/Cancelar la invitación para member@orbit\.pe/),
    ).toBeInTheDocument();
    expect(mocks.cancelInvitation).not.toHaveBeenCalled();

    fireEvent.click(
      screen.getByRole("button", { name: "Confirmar cancelación" }),
    );
    await waitFor(() =>
      expect(mocks.cancelInvitation).toHaveBeenCalledWith({
        invitationId: "invitation-1",
      }),
    );
    expect(onRefresh).toHaveBeenCalledOnce();
  });
});
