import { createProjectTaskService } from "../../src/project-tasks/project-task-service";

export const testProjectTaskService = createProjectTaskService({
  findActiveMember: async () => null,
  find: async () => null,
  list: async () => ({ projectExists: false, tasks: [], total: 0 }),
  calendar: async () => ({
    tasks: [],
    markers: [],
    undatedTaskCount: 0,
    truncated: false,
  }),
  listUndated: async () => ({ tasks: [], total: 0 }),
  schedule: async () => ({ projectExists: false, schedule: null }),
  create: async () => ({ status: "not_found" }),
  update: async () => ({ status: "not_found" }),
  replaceResponsibles: async () => ({ status: "not_found" }),
  archive: async () => ({ status: "not_found" }),
  restore: async () => ({ status: "not_found" }),
});
