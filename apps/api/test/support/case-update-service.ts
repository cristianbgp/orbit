import type { CaseUpdateService } from "../../src/case-updates/case-update-service";

export const testCaseUpdateService = {
  list: async () => ({
    updates: [],
    pagination: { page: 1, pageSize: 10, total: 0, totalPages: 0 },
  }),
  create: async () => {
    throw new Error("Unexpected case update create");
  },
  update: async () => {
    throw new Error("Unexpected case update update");
  },
  archive: async () => {
    throw new Error("Unexpected case update archive");
  },
  restore: async () => {
    throw new Error("Unexpected case update restore");
  },
  previewMoveAllToBackground: async () => {
    throw new Error("Unexpected case update background conversion preview");
  },
  moveAllToBackground: async () => {
    throw new Error("Unexpected case update background conversion");
  },
} satisfies CaseUpdateService;
