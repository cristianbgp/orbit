import type { AccountRecoveryService } from "../../src/account-recovery/account-recovery-service";

export const testAccountRecoveryService: AccountRecoveryService = {
  async generateForMember() {
    return {
      url: "https://app.orbit.pe/reset-password?token=test-token",
      expiresAt: new Date("2026-08-18T15:30:00.000Z"),
    };
  },
  async generateOperationally() {
    return {
      url: "https://app.orbit.pe/reset-password?token=test-token",
      expiresAt: new Date("2026-08-18T15:30:00.000Z"),
    };
  },
  async recordCompletion() {},
};
