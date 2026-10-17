import type { CaseEventService } from "../../src/case-events/case-event-service";

export const testCaseEventService = {
  list: async () => ({
    events: [],
    pagination: { page: 1, pageSize: 25, total: 0, totalPages: 0 },
  }),
} as unknown as CaseEventService;
