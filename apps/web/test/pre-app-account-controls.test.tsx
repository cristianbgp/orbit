import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";

async function loadControls() {
  return import("@/features/auth/pre-app-account-controls").catch(() => null);
}

describe("pre-app account controls", () => {
  test("shows the active account and a sign-out action", async () => {
    const module = await loadControls();
    expect(module).not.toBeNull();
    const { PreAppAccountBar, usePreAppSignOut } = module!;

    const Harness = () => {
      const controller = usePreAppSignOut(vi.fn());
      return (
        <PreAppAccountBar
          account={{
            email: "ana-con-un-correo-muy-largo@estudio-orbit.pe",
            ...controller,
          }}
        />
      );
    };

    render(<Harness />);

    expect(screen.getByText("Orbit")).toBeVisible();
    const email = screen.getByText(
      "ana-con-un-correo-muy-largo@estudio-orbit.pe",
    );
    expect(email).toBeVisible();
    expect(email).toHaveClass("break-all");
    expect(email).not.toHaveClass("truncate");
    expect(screen.getByRole("button", { name: "Cerrar sesión" })).toBeEnabled();
  });

  test("prevents duplicate sign-out requests while pending", async () => {
    const module = await loadControls();
    expect(module).not.toBeNull();
    const { PreAppAccountBar, usePreAppSignOut } = module!;

    let resolveSignOut: (() => void) | undefined;
    const onSignOut = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveSignOut = resolve;
        }),
    );
    const Harness = () => {
      const controller = usePreAppSignOut(onSignOut);
      const account = { email: "ana@orbit.pe", ...controller };
      return (
        <>
          <PreAppAccountBar account={account} />
          <button
            type="button"
            disabled={account.isSigningOut}
            onClick={() => void account.signOut()}
          >
            Usar otra cuenta
          </button>
        </>
      );
    };

    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "Cerrar sesión" }));

    const pending = await screen.findByRole("button", {
      name: "Cerrando sesión…",
    });
    expect(pending).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Usar otra cuenta" }),
    ).toBeDisabled();
    fireEvent.click(pending);
    expect(onSignOut).toHaveBeenCalledOnce();

    resolveSignOut?.();
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Cerrar sesión" }),
      ).toBeEnabled(),
    );
  });

  test("shows a recoverable sign-out error and clears it on retry", async () => {
    const module = await loadControls();
    expect(module).not.toBeNull();
    const { PreAppAccountBar, usePreAppSignOut } = module!;

    const onSignOut = vi
      .fn()
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce(undefined);
    const Harness = () => {
      const controller = usePreAppSignOut(onSignOut);
      return (
        <PreAppAccountBar account={{ email: "ana@orbit.pe", ...controller }} />
      );
    };

    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "Cerrar sesión" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "No pudimos cerrar la sesión. Inténtalo nuevamente.",
    );
    fireEvent.click(screen.getByRole("button", { name: "Cerrar sesión" }));

    await waitFor(() => expect(onSignOut).toHaveBeenCalledTimes(2));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
