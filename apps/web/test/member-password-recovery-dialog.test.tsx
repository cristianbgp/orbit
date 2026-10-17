import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { MemberPasswordRecoveryDialog } from "@/features/team/member-password-recovery-dialog";

const mocks = vi.hoisted(() => ({
  mutateAsync: vi.fn(),
  reset: vi.fn(),
}));

vi.mock("@/lib/api/generated/team/team", () => ({
  useCreateMemberPasswordRecoveryLink: () => ({
    mutateAsync: mocks.mutateAsync,
    reset: mocks.reset,
  }),
}));

const member = {
  userId: "user-2",
  name: "Ana Torres",
  email: "ana@orbit.pe",
};

function Harness() {
  const [open, setOpen] = useState(true);
  return (
    <MemberPasswordRecoveryDialog
      member={member}
      open={open}
      onOpenChange={setOpen}
    />
  );
}

describe("MemberPasswordRecoveryDialog", () => {
  beforeEach(() => {
    mocks.mutateAsync.mockReset().mockResolvedValue({
      url: "https://app.orbit.pe/reset-password?token=secret-token",
      expiresAt: "2026-08-18T15:30:00.000Z",
    });
    mocks.reset.mockReset();
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
  });

  test("confirms the target before generating and displaying one link", async () => {
    render(<Harness />);

    expect(
      screen.getByRole("dialog", { name: "Recuperar acceso" }),
    ).toBeVisible();
    expect(screen.getByText("Ana Torres")).toBeVisible();
    expect(screen.getByText("ana@orbit.pe")).toBeVisible();
    expect(screen.getByText(/vence en 30 minutos/i)).toBeVisible();
    expect(mocks.mutateAsync).not.toHaveBeenCalled();

    fireEvent.click(
      screen.getByRole("button", { name: "Generar enlace seguro" }),
    );

    const link = await screen.findByDisplayValue(
      "https://app.orbit.pe/reset-password?token=secret-token",
    );
    expect(link).toHaveAttribute("readonly");
    expect(mocks.mutateAsync).toHaveBeenCalledWith({ userId: "user-2" });
  });

  test("copies the exact link and discards it when closed", async () => {
    render(<Harness />);
    fireEvent.click(
      screen.getByRole("button", { name: "Generar enlace seguro" }),
    );
    await screen.findByDisplayValue(
      "https://app.orbit.pe/reset-password?token=secret-token",
    );

    fireEvent.click(screen.getByRole("button", { name: "Copiar enlace" }));
    await waitFor(() =>
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
        "https://app.orbit.pe/reset-password?token=secret-token",
      ),
    );
    fireEvent.click(screen.getByRole("button", { name: "Cerrar" }));

    await waitFor(() =>
      expect(
        screen.queryByDisplayValue(
          "https://app.orbit.pe/reset-password?token=secret-token",
        ),
      ).not.toBeInTheDocument(),
    );
    expect(mocks.reset).toHaveBeenCalledOnce();
  });

  test("shows a safe retry state and prevents duplicate generation", async () => {
    let rejectRequest: ((error: Error) => void) | undefined;
    mocks.mutateAsync.mockReturnValue(
      new Promise((_, reject) => {
        rejectRequest = reject;
      }),
    );
    render(<Harness />);

    const button = screen.getByRole("button", {
      name: "Generar enlace seguro",
    });
    fireEvent.click(button);
    fireEvent.click(button);
    expect(mocks.mutateAsync).toHaveBeenCalledOnce();
    rejectRequest?.(new Error("database token secret"));

    expect(
      await screen.findByText(
        "No pudimos generar el enlace. Inténtalo nuevamente.",
      ),
    ).toBeVisible();
    expect(
      screen.queryByText(/database token secret/i),
    ).not.toBeInTheDocument();
  });
});
