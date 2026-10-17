import { accountRecoveryService } from "../auth/runtime";
import { runRecoveryCli } from "./recovery-cli";

process.exitCode = await runRecoveryCli(
  Bun.argv.slice(2),
  accountRecoveryService,
  (value) => process.stdout.write(value),
  (value) => process.stderr.write(value),
);
