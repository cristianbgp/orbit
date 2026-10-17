import { createProjectStageService } from "../../src/project-stages/project-stage-service";

export const testProjectStageService = createProjectStageService({
  getMembershipRole: async () => null,
  projectExists: async () => false,
  list: async () => [],
  create: async () => {
    throw new Error(
      "Project stage persistence is not configured for this test",
    );
  },
  update: async () => null,
  reorder: async () => null,
  remove: async () => "not_found",
});
