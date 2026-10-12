import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";

import { PreAppStatusScreen } from "@/features/auth/pre-app-status-screen";

describe("PreAppStatusScreen", () => {
  test("renders a responsive polite loading screen without account controls", () => {
    const { container } = render(
      <PreAppStatusScreen
        state="loading"
        title="Preparando tu sesión"
        description="Estamos comprobando tu acceso seguro a Orbit."
      />,
    );

    expect(
      screen.getByRole("status", { name: "Preparando tu sesión" }),
    ).toHaveAttribute("data-slot", "pre-app-status-screen");
    expect(
      screen.getByRole("heading", { name: "Preparando tu sesión" }),
    ).toBeVisible();
    expect(screen.getByText("Orbit")).toBeVisible();
    expect(container.firstElementChild).toHaveClass(
      "min-h-svh",
      "min-w-0",
      "overflow-x-hidden",
    );
    expect(
      screen.getByTestId("pre-app-status-layout").parentElement,
    ).toHaveClass("min-h-svh");
    expect(screen.getByTestId("pre-app-status-layout")).toHaveClass(
      "grid-cols-1",
      "lg:grid-cols-2",
    );
    expect(screen.getByTestId("pre-app-loading-orbit")).toHaveClass(
      "motion-safe:animate-spin",
    );
    expect(
      screen.queryByRole("button", { name: "Cerrar sesión" }),
    ).not.toBeInTheDocument();
  });

  test("preserves the header geometry while the authenticated account becomes available", () => {
    const account = {
      email: "cristian@estudio.pe",
      signOut: vi.fn().mockResolvedValue(undefined),
      isSigningOut: false,
      signOutError: null,
    };
    const { rerender } = render(
      <PreAppStatusScreen
        state="loading"
        title="Preparando tu sesión"
        description="Estamos comprobando tu acceso seguro a Orbit."
      />,
    );

    const initialHeaderClasses = screen.getByTestId("pre-app-header").className;
    const placeholder = screen.getByTestId("pre-app-account-placeholder");
    const sessionCopy = screen.getByRole("heading", {
      name: "Preparando tu sesión",
    }).parentElement;

    expect(screen.getByTestId("pre-app-account-slot")).toContainElement(
      placeholder,
    );
    expect(sessionCopy).toHaveClass("min-h-28");
    expect(placeholder).toHaveAttribute("aria-hidden", "true");
    expect(
      screen.queryByRole("button", { name: "Cerrar sesión" }),
    ).not.toBeInTheDocument();

    rerender(
      <PreAppStatusScreen
        state="loading"
        title="Preparando tu estudio"
        description="Estamos abriendo tu espacio de trabajo."
        account={account}
      />,
    );

    expect(screen.getByTestId("pre-app-header").className).toBe(
      initialHeaderClasses,
    );
    expect(
      screen.getByRole("heading", { name: "Preparando tu estudio" })
        .parentElement,
    ).toHaveClass("min-h-28");
    expect(
      screen.queryByTestId("pre-app-account-placeholder"),
    ).not.toBeInTheDocument();
    expect(screen.getByTestId("pre-app-account-slot")).toHaveTextContent(
      account.email,
    );
    expect(screen.getByRole("button", { name: "Cerrar sesión" })).toBeVisible();
  });

  test("continues the loading orbit from the shared page clock after remounting", () => {
    const clock = vi.spyOn(performance, "now").mockReturnValue(700);
    const firstScreen = render(
      <PreAppStatusScreen
        state="loading"
        title="Preparando tu sesión"
        description="Estamos comprobando tu acceso seguro a Orbit."
      />,
    );

    expect(screen.getByTestId("pre-app-loading-orbit")).toHaveStyle({
      animationDelay: "-700ms",
    });

    firstScreen.unmount();
    clock.mockReturnValue(1_200);
    render(
      <PreAppStatusScreen
        state="loading"
        title="Preparando tu estudio"
        description="Estamos abriendo tu espacio de trabajo."
      />,
    );

    expect(screen.getByTestId("pre-app-loading-orbit")).toHaveStyle({
      animationDelay: "-1200ms",
    });
    clock.mockRestore();
  });

  test("keeps the account visible and exposes retry on a static error screen", () => {
    const retry = vi.fn();
    const email =
      "cuenta-extraordinariamente-larga-para-mobile@estudio-legal.example";

    render(
      <PreAppStatusScreen
        state="error"
        title="No pudimos comprobar tu estudio"
        description="Revisa tu conexión e inténtalo nuevamente."
        account={{
          email,
          signOut: vi.fn().mockResolvedValue(undefined),
          isSigningOut: false,
          signOutError: null,
        }}
        action={{ label: "Intentar de nuevo", onClick: retry }}
      />,
    );

    expect(
      screen.getByRole("alert", {
        name: "No pudimos comprobar tu estudio",
      }),
    ).toHaveAttribute("data-slot", "pre-app-status-screen");
    expect(screen.getByText(email)).toHaveClass("break-all");
    expect(screen.getByRole("button", { name: "Cerrar sesión" })).toBeVisible();
    expect(
      screen.queryByTestId("pre-app-loading-orbit"),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: "No pudimos comprobar tu estudio",
      }).parentElement,
    ).not.toHaveClass("min-h-28");

    fireEvent.click(screen.getByRole("button", { name: "Intentar de nuevo" }));
    expect(retry).toHaveBeenCalledOnce();
  });
});
