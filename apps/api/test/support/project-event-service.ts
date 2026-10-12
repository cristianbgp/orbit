import type { ProjectEventService } from "../../src/project-events/project-event-service";

export const testProjectEventService = {
  list: async () => ({
    events: [],
    pagination: { page: 1, pageSize: 25, total: 0, totalPages: 0 },
  }),
  create: async () => {
    throw new Error("Unexpected project event create");
  },
  update: async () => {
    throw new Error("Unexpected project event update");
  },
  remove: async () => {
    throw new Error("Unexpected project event remove");
  },
} satisfies ProjectEventService;
