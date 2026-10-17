import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { OrganizationOnboardingPage } from "@/features/organization/organization-onboarding-page";
import type { PreAppAccountControls } from "@/features/auth/pre-app-account-controls";

function accountControls(
  signOut = vi.fn().mockResolvedValue(undefined),
): PreAppAccountControls {
  return {
    email: "ana@orbit.pe",
    signOut,
    isSigningOut: false,
    signOutError: null,
  };
}

describe("OrganizationOnboardingPage", () => {
  beforeEach(() => {
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

  test("suggests an editable Estudio name", () => {
    render(
      <OrganizationOnboardingPage
        userName="Ana Torres"
        account={accountControls()}
        onCreate={vi.fn()}
      />,
    );

    expect(screen.getByLabelText("Nombre del estudio")).toHaveValue(
      "Estudio de Ana Torres",
    );
    expect(screen.getByLabelText("Nombre del estudio")).toHaveFocus();
  });

  test("does not select the studio name automatically on touch screens", () => {
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
      <OrganizationOnboardingPage
        userName="Ana Torres"
        account={accountControls()}
        onCreate={vi.fn()}
      />,
    );

    expect(screen.getByLabelText("Nombre del estudio")).not.toHaveFocus();
  });

  test("submits the trimmed edited name", async () => {
    const onCreate = vi.fn().mockResolvedValue(undefined);
    render(
      <OrganizationOnboardingPage
        userName="Ana"
        account={accountControls()}
        onCreate={onCreate}
      />,
    );

    fireEvent.change(screen.getByLabelText("Nombre del estudio"), {
      target: { value: "  Estudio Lex  " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Crear estudio" }));

    await waitFor(() => expect(onCreate).toHaveBeenCalledWith("Estudio Lex"));
  });

  test("links validation feedback and returns focus to the field", async () => {
    const onCreate = vi.fn();
    render(
      <OrganizationOnboardingPage
        userName="Ana"
        account={accountControls()}
        onCreate={onCreate}
      />,
    );

    const input = screen.getByLabelText("Nombre del estudio");
    fireEvent.change(input, { target: { value: "a" } });
    fireEvent.click(screen.getByRole("button", { name: "Crear estudio" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(
      "El nombre debe tener entre 2 y 120 caracteres.",
    );
    expect(input).toHaveAttribute("aria-describedby", alert.id);
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveFocus();
    expect(onCreate).not.toHaveBeenCalled();
  });

  test("disables duplicate submission while creating", async () => {
    let resolveCreation: (() => void) | undefined;
    const onCreate = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveCreation = resolve;
        }),
    );
    render(
      <OrganizationOnboardingPage
        userName="Ana"
        account={accountControls()}
        onCreate={onCreate}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Crear estudio" }));

    expect(
      await screen.findByRole("button", { name: "Creando estudio…" }),
    ).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Creando estudio…" }));
    expect(onCreate).toHaveBeenCalledOnce();

    resolveCreation?.();
  });

  test("retains the name and shows safe retry guidance after failure", async () => {
    const onCreate = vi
      .fn()
      .mockRejectedValue(new Error("database unavailable"));
    render(
      <OrganizationOnboardingPage
        userName="Ana"
        account={accountControls()}
        onCreate={onCreate}
      />,
    );

    const input = screen.getByLabelText("Nombre del estudio");
    fireEvent.change(input, { target: { value: "Estudio Lex" } });
    fireEvent.click(screen.getByRole("button", { name: "Crear estudio" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "No pudimos crear el estudio. Inténtalo nuevamente.",
    );
    expect(input).toHaveValue("Estudio Lex");
    expect(screen.getByRole("button", { name: "Crear estudio" })).toBeEnabled();
  });

  test("shows the active account and signs out without creating a studio", () => {
    const signOut = vi.fn().mockResolvedValue(undefined);
    const onCreate = vi.fn();
    render(
      <OrganizationOnboardingPage
        userName="Ana"
        account={accountControls(signOut)}
        onCreate={onCreate}
      />,
    );

    expect(screen.getByText("ana@orbit.pe")).toBeVisible();
    expect(screen.queryByText("Tu espacio en Orbit")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Cerrar sesión" }));

    expect(signOut).toHaveBeenCalledOnce();
    expect(onCreate).not.toHaveBeenCalled();
  });
});
