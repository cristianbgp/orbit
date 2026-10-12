import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";

import { AuthShell, type AuthSessionState } from "@/features/auth/auth-shell";

const actions = {
  signIn: vi.fn().mockResolvedValue(undefined),
  signUp: vi.fn().mockResolvedValue(undefined),
};

function renderShell(sessionState: AuthSessionState) {
  render(
    <AuthShell sessionState={sessionState} actions={actions}>
      <p>Contenido protegido</p>
    </AuthShell>,
  );
}

describe("AuthShell", () => {
  test("renders a stable loading state while restoring the session", () => {
    renderShell({ status: "loading" });

    expect(screen.getByText("Preparando tu sesión")).toBeInTheDocument();
    expect(
      screen.getByRole("status", { name: "Preparando tu sesión" }),
    ).toHaveAttribute("data-slot", "pre-app-status-screen");
    expect(screen.queryByText("Contenido protegido")).not.toBeInTheDocument();
  });

  test("renders sign in and lets the user switch to account creation", () => {
    renderShell({ status: "anonymous" });

    expect(
      screen.getByRole("heading", { name: "Bienvenido a Orbit" }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Crear una cuenta" }));

    expect(
      screen.getByRole("heading", { name: "Crea tu cuenta" }),
    ).toBeInTheDocument();
  });

  test("renders dedicated anonymous content instead of the sign-in form", () => {
    render(
      <AuthShell
        sessionState={{
          status: "authenticated",
          user: {
            id: "user-1",
            name: "Cristian",
            email: "cristian@orbit.pe",
          },
        }}
        actions={actions}
        anonymousContent={<h1>Define una nueva contraseña</h1>}
      >
        <p>Contenido protegido</p>
      </AuthShell>,
    );

    expect(
      screen.getByRole("heading", { name: "Define una nueva contraseña" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Bienvenido a Orbit" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("Contenido protegido")).not.toBeInTheDocument();
  });

  test("shows only generic invitation context to signed-out visitors", () => {
    render(
      <AuthShell
        sessionState={{ status: "anonymous" }}
        actions={actions}
        anonymousContext={{
          title: "Tienes una invitación para unirte a un estudio",
          description:
            "Inicia sesión o crea tu cuenta con el correo que recibió la invitación.",
        }}
      >
        <p>Estudio Orbit</p>
      </AuthShell>,
    );

    expect(
      screen.getByRole("heading", {
        name: "Tienes una invitación para unirte a un estudio",
      }),
    ).toBeInTheDocument();
    expect(screen.queryByText("Estudio Orbit")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Correo electrónico")).toBeInTheDocument();
  });

  test("renders a safe session error", () => {
    renderShell({ status: "error" });

    expect(
      screen.getByText("No pudimos comprobar tu sesión"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("alert", {
        name: "No pudimos comprobar tu sesión",
      }),
    ).toHaveAttribute("data-slot", "pre-app-status-screen");
    expect(screen.queryByText("Contenido protegido")).not.toBeInTheDocument();
  });

  test("delegates authenticated application chrome to protected content", () => {
    renderShell({
      status: "authenticated",
      user: {
        id: "user-1",
        name: "Cristian",
        email: "cristian@orbit.pe",
      },
    });

    expect(screen.getByText("Contenido protegido")).toBeInTheDocument();
    expect(
      screen.queryByRole("navigation", { name: "Principal" }),
    ).not.toBeInTheDocument();
  });
});
