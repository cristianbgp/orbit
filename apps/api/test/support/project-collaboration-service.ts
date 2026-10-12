import { createProjectCollaborationService } from "../../src/project-collaboration/project-collaboration-service";

export const testProjectCollaborationService =
  createProjectCollaborationService({
    findActiveMember: async () => null,
    listAssignments: async () => ({
      projectExists: false,
      active: [],
      history: [],
      historyTotal: 0,
    }),
    listCandidates: async () => ({
      projectExists: false,
      candidates: [],
      total: 0,
    }),
    addAssignments: async () => ({ status: "not_found" }),
    changeResponsibility: async () => ({ status: "not_found" }),
    endAssignment: async () => ({ status: "not_found" }),
    listActivities: async () => ({
      projectExists: false,
      activities: [],
      total: 0,
    }),
    removeOrganizationMember: async () => ({ status: "not_found" }),
  });
