import { createMyWorkService } from "../../src/my-work/my-work-service";

export const testMyWorkService = createMyWorkService({
  findMemberContext: async () => null,
  listAssignedTasks: async () => {
    throw new Error("My work persistence is not configured for this test");
  },
  listSupervisedProjects: async () => {
    throw new Error("My work persistence is not configured for this test");
  },
  listAssignedCaseActions: async () => {
    throw new Error(
      "My work case action persistence is not configured for this test",
    );
  },
});
