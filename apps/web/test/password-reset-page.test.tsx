import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { PasswordResetPage } from "@/features/auth/password-reset-page";

const mocks = vi.hoisted(() => ({
  resetPassword: vi.fn(),
}));

vi.mock("@/lib/auth-client", () => ({
  authClient: {
    resetPassword: mocks.resetPassword,
  },
}));

describe("PasswordResetPage", () => {
  beforeEach(() => {
    mocks.resetPassword.mockReset().mockResolvedValue({ error: null });
    vi.stubGlobal(
      "matchMedia",
      vi.fn((query: string) => ({
        matches: query.includes("pointer: fine"),
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("focuses a new-password field and never renders the token", () => {
    render(
      <PasswordResetPage token="private-reset-token" onComplete={vi.fn()} />,
    );

    const password = screen.getByLabelText("Nueva contraseña");
    expect(password).toHaveFocus();
    expect(password).toHaveAttribute("autocomplete", "new-password");
    expect(password).toHaveAttribute("minlength", "8");
    expect(screen.queryByText("private-reset-token")).not.toBeInTheDocument();
  });

  test("does not open the keyboard automatically on a touch device", () => {
    vi.mocked(window.matchMedia).mockReturnValue({
      matches: false,
      media: "(pointer: fine) and (min-width: 768px)",
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    });

    render(
      <PasswordResetPage token="private-reset-token" onComplete={vi.fn()} />,
    );

    expect(screen.getByLabelText("Nueva contraseña")).not.toHaveFocus();
  });

  test("blocks mismatched passwords without calling Better Auth", () => {
    render(
      <PasswordResetPage token="private-reset-token" onComplete={vi.fn()} />,
    );

    fireEvent.change(screen.getByLabelText("Nueva contraseña"), {
      target: { value: "new-password" },
    });
    fireEvent.change(screen.getByLabelText("Confirmar contraseña"), {
      target: { value: "different-password" },
    });
    fireEvent.submit(
      screen.getByRole("button", { name: "Guardar contraseña" }),
    );

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Las contraseñas deben coincidir.",
    );
    expect(mocks.resetPassword).not.toHaveBeenCalled();
  });

  test("submits once and completes with the URL token", async () => {
    const onComplete = vi.fn();
    let resolveReset!: (value: { error: null }) => void;
    mocks.resetPassword.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveReset = resolve;
        }),
    );
    render(
      <PasswordResetPage token="private-reset-token" onComplete={onComplete} />,
    );

    fireEvent.change(screen.getByLabelText("Nueva contraseña"), {
      target: { value: "new-password" },
    });
    fireEvent.change(screen.getByLabelText("Confirmar contraseña"), {
      target: { value: "new-password" },
    });
    const submit = screen.getByRole("button", { name: "Guardar contraseña" });
    fireEvent.click(submit);
    fireEvent.click(submit);

    expect(mocks.resetPassword).toHaveBeenCalledOnce();
    expect(mocks.resetPassword).toHaveBeenCalledWith({
      newPassword: "new-password",
      token: "private-reset-token",
    });
    expect(submit).toBeDisabled();

    resolveReset({ error: null });
    await waitFor(() => expect(onComplete).toHaveBeenCalledOnce());
  });

  test("shows the same safe error for missing, expired, or invalid links", async () => {
    const { rerender } = render(
      <PasswordResetPage token={null} onComplete={vi.fn()} />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Este enlace no es válido o ya venció.",
    );
    expect(
      screen.getByRole("button", { name: "Guardar contraseña" }),
    ).toBeDisabled();

    mocks.resetPassword.mockResolvedValue({
      error: { code: "INVALID_TOKEN", message: "database detail" },
    });
    rerender(<PasswordResetPage token="invalid-token" onComplete={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("Nueva contraseña"), {
      target: { value: "new-password" },
    });
    fireEvent.change(screen.getByLabelText("Confirmar contraseña"), {
      target: { value: "new-password" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Guardar contraseña" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Este enlace no es válido o ya venció.",
    );
    expect(screen.queryByText("database detail")).not.toBeInTheDocument();
  });
});
