import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";

import { AuthForm, type AuthFormActions } from "@/features/auth/auth-form";

function createActions(
  overrides: Partial<AuthFormActions> = {},
): AuthFormActions {
  return {
    signIn: vi.fn().mockResolvedValue(undefined),
    signUp: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe("AuthForm", () => {
  test("explains how password recovery works without email delivery", () => {
    const actions = createActions();
    render(
      <AuthForm mode="sign-in" actions={actions} onModeChange={vi.fn()} />,
    );

    expect(
      screen.getByText(
        "¿Olvidaste tu contraseña? Solicita un enlace al propietario de tu estudio.",
      ),
    ).toBeInTheDocument();
  });
  test("submits email and password for sign in", async () => {
    const actions = createActions();

    render(
      <AuthForm
        mode="sign-in"
        actions={actions}
        onModeChange={() => undefined}
      />,
    );

    expect(screen.getByLabelText("Correo electrónico")).toHaveAttribute(
      "autocomplete",
      "email",
    );
    expect(screen.getByLabelText("Contraseña")).toHaveAttribute(
      "autocomplete",
      "current-password",
    );

    fireEvent.change(screen.getByLabelText("Correo electrónico"), {
      target: { value: "user@orbit.pe" },
    });
    fireEvent.change(screen.getByLabelText("Contraseña"), {
      target: { value: "correct-horse-battery-staple" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Iniciar sesión" }));

    await waitFor(() =>
      expect(actions.signIn).toHaveBeenCalledWith({
        email: "user@orbit.pe",
        password: "correct-horse-battery-staple",
      }),
    );
  });

  test("prevents account creation when password confirmation differs", async () => {
    const actions = createActions();

    render(
      <AuthForm
        mode="sign-up"
        actions={actions}
        onModeChange={() => undefined}
      />,
    );

    fireEvent.change(screen.getByLabelText("Nombre completo"), {
      target: { value: "Cristian" },
    });
    fireEvent.change(screen.getByLabelText("Correo electrónico"), {
      target: { value: "user@orbit.pe" },
    });
    fireEvent.change(screen.getByLabelText("Contraseña"), {
      target: { value: "correct-horse-battery-staple" },
    });
    fireEvent.change(screen.getByLabelText("Confirmar contraseña"), {
      target: { value: "different-password" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Crear cuenta" }));

    expect(
      await screen.findByText("Las contraseñas deben coincidir."),
    ).toBeInTheDocument();
    expect(actions.signUp).not.toHaveBeenCalled();
  });

  test("submits name, email, and password for account creation", async () => {
    const actions = createActions();

    render(
      <AuthForm
        mode="sign-up"
        actions={actions}
        onModeChange={() => undefined}
      />,
    );

    fireEvent.change(screen.getByLabelText("Nombre completo"), {
      target: { value: "Cristian" },
    });
    fireEvent.change(screen.getByLabelText("Correo electrónico"), {
      target: { value: "user@orbit.pe" },
    });
    fireEvent.change(screen.getByLabelText("Contraseña"), {
      target: { value: "correct-horse-battery-staple" },
    });
    fireEvent.change(screen.getByLabelText("Confirmar contraseña"), {
      target: { value: "correct-horse-battery-staple" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Crear cuenta" }));

    await waitFor(() =>
      expect(actions.signUp).toHaveBeenCalledWith({
        name: "Cristian",
        email: "user@orbit.pe",
        password: "correct-horse-battery-staple",
      }),
    );
  });

  test("disables submission while the request is pending", async () => {
    const actions = createActions({
      signIn: vi.fn(() => new Promise<void>(() => undefined)),
    });

    render(
      <AuthForm
        mode="sign-in"
        actions={actions}
        onModeChange={() => undefined}
      />,
    );

    fireEvent.change(screen.getByLabelText("Correo electrónico"), {
      target: { value: "user@orbit.pe" },
    });
    fireEvent.change(screen.getByLabelText("Contraseña"), {
      target: { value: "correct-horse-battery-staple" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Iniciar sesión" }));

    expect(
      await screen.findByRole("button", { name: "Iniciando sesión…" }),
    ).toBeDisabled();
  });

  test("shows a safe message when the server rejects authentication", async () => {
    const actions = createActions({
      signIn: vi.fn().mockRejectedValue(new Error("database URL leaked")),
    });

    render(
      <AuthForm
        mode="sign-in"
        actions={actions}
        onModeChange={() => undefined}
      />,
    );

    fireEvent.change(screen.getByLabelText("Correo electrónico"), {
      target: { value: "user@orbit.pe" },
    });
    fireEvent.change(screen.getByLabelText("Contraseña"), {
      target: { value: "wrong-password" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Iniciar sesión" }));

    expect(
      await screen.findByText(
        "No pudimos completar la solicitud. Revisa tus datos e inténtalo otra vez.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText("database URL leaked")).not.toBeInTheDocument();
  });
});
