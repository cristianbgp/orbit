import type { CaseActionService } from "../../src/case-actions/case-action-service";

export const testCaseActionService = {
  list: async () => ({
    actions: [],
    pagination: { page: 1, pageSize: 20, total: 0, totalPages: 0 },
  }),
  create: async () => {
    throw new Error("Unexpected case action create");
  },
  update: async () => {
    throw new Error("Unexpected case action update");
  },
  complete: async () => {
    throw new Error("Unexpected case action complete");
  },
  reopen: async () => {
    throw new Error("Unexpected case action reopen");
  },
  archive: async () => {
    throw new Error("Unexpected case action archive");
  },
  restore: async () => {
    throw new Error("Unexpected case action restore");
  },
} satisfies CaseActionService;
