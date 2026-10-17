import { createDashboardService } from "../../src/dashboard/dashboard-service";

export const testDashboardService = createDashboardService({
  findMemberContext: async () => null,
  listActivity: async () => {
    throw new Error("Dashboard persistence is not configured for this test");
  },
});
