import type { CaseService } from "../../src/cases/case-service";

export const testCaseService = {
  list: async () => ({
    cases: [],
    pagination: { page: 1, pageSize: 25, total: 0, totalPages: 0 },
  }),
  listGroupedByClient: async () => ({
    groups: [],
    caseTotal: 0,
    pagination: { page: 1, pageSize: 10, total: 0, totalPages: 0 },
  }),
  get: async () => {
    throw new Error("Not implemented in test support");
  },
  create: async () => {
    throw new Error("Not implemented in test support");
  },
  update: async () => {
    throw new Error("Not implemented in test support");
  },
  archive: async () => {
    throw new Error("Not implemented in test support");
  },
  restore: async () => {
    throw new Error("Not implemented in test support");
  },
  listAssignments: async () => ({ active: [], history: [], historyTotal: 0 }),
  listCandidates: async () => [],
  addAssignments: async () => undefined,
  endAssignment: async () => undefined,
  listActivities: async () => ({
    activities: [],
    pagination: { page: 1, pageSize: 20, total: 0, totalPages: 0 },
  }),
} as unknown as CaseService;
