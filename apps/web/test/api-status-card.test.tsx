import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";

import { ApiStatusCard } from "@/features/system-status/api-status-card";

describe("ApiStatusCard", () => {
  test("renders the loading state", () => {
    render(<ApiStatusCard state="loading" onRetry={() => undefined} />);

    expect(screen.getByText("Conectando con Orbit")).toBeInTheDocument();
    expect(screen.getByText("Comprobando la base técnica")).toBeInTheDocument();
  });

  test("renders the available state", () => {
    render(<ApiStatusCard state="available" onRetry={() => undefined} />);

    expect(screen.getByText("API disponible")).toBeInTheDocument();
    expect(
      screen.getByText("La base de Orbit está operativa."),
    ).toBeInTheDocument();
  });

  test("renders the unavailable state and retries", () => {
    const onRetry = vi.fn();

    render(<ApiStatusCard state="unavailable" onRetry={onRetry} />);

    expect(screen.getByText("API no disponible")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
