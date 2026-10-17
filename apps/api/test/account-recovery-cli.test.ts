import { describe, expect, test, vi } from "vitest";

import { runRecoveryCli } from "../src/account-recovery/recovery-cli";

function setup() {
  const generateOperationally = vi.fn().mockResolvedValue({
    url: "https://app.orbit.pe/reset-password?token=private-token",
    expiresAt: new Date("2026-08-18T15:30:00.000Z"),
  });
  const out = vi.fn();
  const error = vi.fn();
  return { generateOperationally, out, error };
}

describe("runRecoveryCli", () => {
  test.each([
    [[]],
    [["--email"]],
    [["--email", "ana@orbit.pe", "--email", "other@orbit.pe"]],
    [["--unknown", "ana@orbit.pe"]],
    [["--email", "not-an-email"]],
  ])(
    "rejects invalid arguments without contacting the service: %j",
    async (args) => {
      const context = setup();

      const exitCode = await runRecoveryCli(
        args,
        { generateOperationally: context.generateOperationally },
        context.out,
        context.error,
      );

      expect(exitCode).toBe(1);
      expect(context.generateOperationally).not.toHaveBeenCalled();
      expect(context.out).not.toHaveBeenCalled();
      expect(context.error).toHaveBeenCalledWith(
        "Uso: bun run auth:recovery-link --email usuario@estudio.pe\n",
      );
    },
  );

  test("prints only the sensitive link and its expiry after success", async () => {
    const context = setup();

    const exitCode = await runRecoveryCli(
      ["--email", "ANA@ORBIT.PE"],
      { generateOperationally: context.generateOperationally },
      context.out,
      context.error,
    );

    expect(exitCode).toBe(0);
    expect(context.generateOperationally).toHaveBeenCalledOnce();
    expect(context.generateOperationally).toHaveBeenCalledWith("ANA@ORBIT.PE");
    expect(context.out).toHaveBeenCalledOnce();
    expect(context.out).toHaveBeenCalledWith(
      "Enlace: https://app.orbit.pe/reset-password?token=private-token\nVence: 2026-08-18T15:30:00.000Z\n",
    );
    expect(context.error).not.toHaveBeenCalled();
  });

  test("never prints service details, emails, or partial secrets on failure", async () => {
    const context = setup();
    context.generateOperationally.mockRejectedValue(
      new Error(
        "database failed for ana@orbit.pe token=private-token connection URL",
      ),
    );

    const exitCode = await runRecoveryCli(
      ["--email", "ana@orbit.pe"],
      { generateOperationally: context.generateOperationally },
      context.out,
      context.error,
    );

    expect(exitCode).toBe(1);
    expect(context.out).not.toHaveBeenCalled();
    expect(context.error).toHaveBeenCalledWith(
      "No se pudo generar el enlace de recuperación.\n",
    );
    expect(JSON.stringify(context.error.mock.calls)).not.toContain(
      "ana@orbit.pe",
    );
    expect(JSON.stringify(context.error.mock.calls)).not.toContain(
      "private-token",
    );
    expect(JSON.stringify(context.error.mock.calls)).not.toContain("database");
  });
});
