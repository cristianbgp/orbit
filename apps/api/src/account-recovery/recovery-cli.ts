import { z } from "zod";

type OperationalRecoveryService = {
  generateOperationally(email: string): Promise<{
    url: string;
    expiresAt: Date;
  }>;
};

type Write = (value: string) => void;

const emailSchema = z.email();
const USAGE = "Uso: bun run auth:recovery-link --email usuario@estudio.pe\n";
const SAFE_FAILURE = "No se pudo generar el enlace de recuperación.\n";

export async function runRecoveryCli(
  args: string[],
  service: OperationalRecoveryService,
  writeOut: Write,
  writeError: Write,
): Promise<number> {
  if (
    args.length !== 2 ||
    args[0] !== "--email" ||
    !emailSchema.safeParse(args[1]).success
  ) {
    writeError(USAGE);
    return 1;
  }

  try {
    const result = await service.generateOperationally(args[1]);
    writeOut(
      `Enlace: ${result.url}\nVence: ${result.expiresAt.toISOString()}\n`,
    );
    return 0;
  } catch {
    writeError(SAFE_FAILURE);
    return 1;
  }
}
