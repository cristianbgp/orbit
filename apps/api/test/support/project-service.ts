import { createProjectService } from "../../src/projects/project-service";

export const testProjectService = createProjectService({
  hasMembership: async () => false,
  findClient: async () => null,
  list: async () => ({ projects: [], total: 0 }),
  listGroupedByClient: async () => ({
    groups: [],
    clientTotal: 0,
    projectTotal: 0,
  }),
  get: async () => null,
  create: async () => {
    throw new Error("Project persistence is not configured for this test");
  },
  update: async () => ({ status: "not_found" }),
  archive: async () => ({ status: "not_found" }),
  restore: async () => ({ status: "not_found" }),
});
