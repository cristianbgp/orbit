import type { CasePresentationService } from "../../src/case-presentation/case-presentation-service";

export const testCasePresentationService = {
  list: async () => ({
    generatedAt: new Date("2026-09-04T12:00:00.000Z"),
    organizationDate: "2026-09-04",
    clients: [],
    truncated: { value: false, scopes: [] },
  }),
} as unknown as CasePresentationService;
