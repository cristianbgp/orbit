import type {
  ActiveCollaborationMember,
  ProjectActivityRecord,
  ProjectAssignmentCandidate,
  ProjectAssignmentRecord,
  ProjectCollaborationActor,
  ProjectResponsibility,
} from "./project-collaboration-types";

export type ProjectCollaborationServiceErrorCode =
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "VALIDATION_ERROR"
  | "LAST_OWNER"
  | "PROJECT_ARCHIVED";

export class ProjectCollaborationServiceError extends Error {
  constructor(
    readonly code: ProjectCollaborationServiceErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "ProjectCollaborationServiceError";
  }
}

type PageInput = { page?: number; pageSize?: number };
type HistoryPageInput = {
  historyPage?: number;
  historyPageSize?: number;
};

type AssignmentInput = {
  userId: string;
  responsibility: ProjectResponsibility;
};

type AssignmentWriteResult =
  | { status: "created"; assignments: ProjectAssignmentRecord[] }
  | { status: "updated" | "unchanged"; assignment: ProjectAssignmentRecord }
  | { status: "ended"; assignment: ProjectAssignmentRecord }
  | {
      status: "forbidden" | "not_found" | "conflict" | "project_archived";
    };

type MemberRemovalResult =
  | {
      status: "removed";
      member: { id: string; userId: string; name: string };
    }
  | { status: "forbidden" | "last_owner" | "conflict" | "not_found" };

export type ProjectCollaborationStore = {
  findActiveMember(
    userId: string,
    organizationId: string,
  ): Promise<ActiveCollaborationMember | null>;
  listAssignments(
    organizationId: string,
    projectId: string,
    input: { historyPage: number; historyPageSize: number },
  ): Promise<{
    projectExists: boolean;
    active: ProjectAssignmentRecord[];
    history: ProjectAssignmentRecord[];
    historyTotal: number;
  }>;
  listCandidates(
    organizationId: string,
    projectId: string,
    input: { search?: string; page: number; pageSize: number },
  ): Promise<{
    projectExists: boolean;
    candidates: ProjectAssignmentCandidate[];
    total: number;
  }>;
  addAssignments(input: {
    actor: ActiveCollaborationMember;
    projectId: string;
    assignments: AssignmentInput[];
  }): Promise<AssignmentWriteResult>;
  changeResponsibility(input: {
    actor: ActiveCollaborationMember;
    projectId: string;
    assignmentId: string;
    responsibility: ProjectResponsibility;
  }): Promise<AssignmentWriteResult>;
  endAssignment(input: {
    actor: ActiveCollaborationMember;
    projectId: string;
    assignmentId: string;
  }): Promise<AssignmentWriteResult>;
  listActivities(
    organizationId: string,
    projectId: string,
    input: { page: number; pageSize: number },
  ): Promise<{
    projectExists: boolean;
    activities: ProjectActivityRecord[];
    total: number;
  }>;
  removeOrganizationMember(input: {
    actor: ActiveCollaborationMember;
    memberId: string;
  }): Promise<MemberRemovalResult>;
};

function pagination(page: number, pageSize: number, total: number) {
  return {
    page,
    pageSize,
    total,
    totalPages: total === 0 ? 0 : Math.ceil(total / pageSize),
  };
}

function throwForStatus(status: string): never {
  switch (status) {
    case "forbidden":
      throw new ProjectCollaborationServiceError(
        "FORBIDDEN",
        "No tienes permiso para realizar esta acción.",
      );
    case "not_found":
      throw new ProjectCollaborationServiceError(
        "NOT_FOUND",
        "El recurso solicitado no está disponible.",
      );
    case "last_owner":
      throw new ProjectCollaborationServiceError(
        "LAST_OWNER",
        "El estudio debe conservar al menos un propietario.",
      );
    case "project_archived":
      throw new ProjectCollaborationServiceError(
        "PROJECT_ARCHIVED",
        "El proyecto está archivado. Restáuralo para realizar cambios.",
      );
    default:
      throw new ProjectCollaborationServiceError(
        "CONFLICT",
        "La información cambió. Actualiza la página e inténtalo nuevamente.",
      );
  }
}

export function createProjectCollaborationService(
  store: ProjectCollaborationStore,
) {
  async function getActor(actor: ProjectCollaborationActor) {
    const member = await store.findActiveMember(
      actor.userId,
      actor.organizationId,
    );
    if (!member) {
      throw new ProjectCollaborationServiceError(
        "FORBIDDEN",
        "No tienes acceso a este estudio.",
      );
    }
    return member;
  }

  return {
    async listAssignments(
      actor: ProjectCollaborationActor,
      projectId: string,
      input: HistoryPageInput,
    ) {
      await getActor(actor);
      const historyPage = input.historyPage ?? 1;
      const historyPageSize = input.historyPageSize ?? 25;
      const result = await store.listAssignments(
        actor.organizationId,
        projectId,
        { historyPage, historyPageSize },
      );
      if (!result.projectExists) throwForStatus("not_found");
      return {
        active: result.active,
        history: result.history,
        historyPagination: pagination(
          historyPage,
          historyPageSize,
          result.historyTotal,
        ),
      };
    },

    async listCandidates(
      actor: ProjectCollaborationActor,
      projectId: string,
      input: PageInput & { search?: string },
    ) {
      await getActor(actor);
      const page = input.page ?? 1;
      const pageSize = input.pageSize ?? 25;
      const result = await store.listCandidates(
        actor.organizationId,
        projectId,
        {
          search: input.search?.trim() || undefined,
          page,
          pageSize,
        },
      );
      if (!result.projectExists) throwForStatus("not_found");
      return {
        candidates: result.candidates,
        pagination: pagination(page, pageSize, result.total),
      };
    },

    async addAssignments(
      actor: ProjectCollaborationActor,
      projectId: string,
      assignments: AssignmentInput[],
    ) {
      const activeActor = await getActor(actor);
      if (
        assignments.length === 0 ||
        new Set(assignments.map(({ userId }) => userId)).size !==
          assignments.length
      ) {
        throw new ProjectCollaborationServiceError(
          "VALIDATION_ERROR",
          "Selecciona integrantes distintos para el proyecto.",
        );
      }
      const result = await store.addAssignments({
        actor: activeActor,
        projectId,
        assignments,
      });
      if (result.status !== "created") throwForStatus(result.status);
      return result.assignments;
    },

    async changeResponsibility(
      actor: ProjectCollaborationActor,
      projectId: string,
      assignmentId: string,
      responsibility: ProjectResponsibility,
    ) {
      const activeActor = await getActor(actor);
      const result = await store.changeResponsibility({
        actor: activeActor,
        projectId,
        assignmentId,
        responsibility,
      });
      if (result.status !== "updated" && result.status !== "unchanged") {
        throwForStatus(result.status);
      }
      return result.assignment;
    },

    async endAssignment(
      actor: ProjectCollaborationActor,
      projectId: string,
      assignmentId: string,
    ) {
      const activeActor = await getActor(actor);
      const result = await store.endAssignment({
        actor: activeActor,
        projectId,
        assignmentId,
      });
      if (result.status !== "ended") throwForStatus(result.status);
      return result.assignment;
    },

    async listActivities(
      actor: ProjectCollaborationActor,
      projectId: string,
      input: PageInput,
    ) {
      await getActor(actor);
      const page = input.page ?? 1;
      const pageSize = input.pageSize ?? 25;
      const result = await store.listActivities(
        actor.organizationId,
        projectId,
        { page, pageSize },
      );
      if (!result.projectExists) throwForStatus("not_found");
      return {
        activities: result.activities,
        pagination: pagination(page, pageSize, result.total),
      };
    },

    async removeOrganizationMember(
      actor: ProjectCollaborationActor,
      memberId: string,
    ) {
      const activeActor = await getActor(actor);
      const result = await store.removeOrganizationMember({
        actor: activeActor,
        memberId,
      });
      if (result.status !== "removed") throwForStatus(result.status);
      return result.member;
    },
  };
}

export type ProjectCollaborationService = ReturnType<
  typeof createProjectCollaborationService
>;
