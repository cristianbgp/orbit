import type { ProjectActor } from "../projects/project-types";
import type {
  CreateProjectStageInput,
  ProjectStageCreateValues,
  ProjectStagePatchValues,
  ProjectStageRecord,
  ReorderProjectStagesInput,
  UpdateProjectStageInput,
} from "./project-stage-types";

export type ProjectStageServiceErrorCode =
  "FORBIDDEN" | "NOT_FOUND" | "INVALID_ORDER" | "CONFLICT" | "PROJECT_ARCHIVED";

export class ProjectStageServiceError extends Error {
  readonly code: ProjectStageServiceErrorCode;

  constructor(code: ProjectStageServiceErrorCode, message: string) {
    super(message);
    this.name = "ProjectStageServiceError";
    this.code = code;
  }
}

export type ProjectStageStore = {
  getMembershipRole(
    userId: string,
    organizationId: string,
  ): Promise<string | null>;
  projectExists(organizationId: string, projectId: string): Promise<boolean>;
  list(
    organizationId: string,
    projectId: string,
  ): Promise<ProjectStageRecord[]>;
  create(
    actor: ProjectActor,
    projectId: string,
    values: ProjectStageCreateValues,
  ): Promise<ProjectStageRecord | { status: "not_found" | "project_archived" }>;
  update(
    actor: ProjectActor,
    projectId: string,
    stageId: string,
    values: ProjectStagePatchValues,
  ): Promise<ProjectStageRecord | null | { status: "project_archived" }>;
  reorder(
    actor: ProjectActor,
    projectId: string,
    stageIds: string[],
  ): Promise<ProjectStageRecord[] | null | { status: "project_archived" }>;
  remove(
    actor: ProjectActor,
    projectId: string,
    stageId: string,
  ): Promise<"removed" | "not_found" | "in_use" | "project_archived">;
};

function normalizeDescription(value: string | null | undefined) {
  if (value === null || value === undefined) return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function hasExactIds(requested: string[], current: ProjectStageRecord[]) {
  if (new Set(requested).size !== requested.length) return false;
  if (requested.length !== current.length) return false;
  const currentIds = new Set(current.map(({ id }) => id));
  return requested.every((id) => currentIds.has(id));
}

export function createProjectStageService(
  store: ProjectStageStore,
  createId: () => string = () => crypto.randomUUID(),
) {
  async function membershipRole(actor: ProjectActor) {
    const role = await store.getMembershipRole(
      actor.userId,
      actor.organizationId,
    );
    if (!role) {
      throw new ProjectStageServiceError(
        "FORBIDDEN",
        "No tienes acceso a este estudio.",
      );
    }
    return role;
  }

  async function assertMember(actor: ProjectActor) {
    await membershipRole(actor);
  }

  async function assertProject(organizationId: string, projectId: string) {
    if (!(await store.projectExists(organizationId, projectId))) {
      throw new ProjectStageServiceError(
        "NOT_FOUND",
        "Proyecto no encontrado.",
      );
    }
  }

  function invalidOrder() {
    return new ProjectStageServiceError(
      "INVALID_ORDER",
      "El orden de las etapas ya no está actualizado.",
    );
  }

  function archivedProject(): never {
    throw new ProjectStageServiceError(
      "PROJECT_ARCHIVED",
      "El proyecto está archivado. Restáuralo para realizar cambios.",
    );
  }

  return {
    async list(actor: ProjectActor, projectId: string) {
      await membershipRole(actor);
      await assertProject(actor.organizationId, projectId);
      return store.list(actor.organizationId, projectId);
    },

    async create(
      actor: ProjectActor,
      projectId: string,
      input: CreateProjectStageInput,
    ) {
      await assertMember(actor);
      await assertProject(actor.organizationId, projectId);
      const result = await store.create(actor, projectId, {
        id: createId(),
        name: input.name.trim(),
        description: normalizeDescription(input.description),
      });
      if ("status" in result) {
        if (result.status === "project_archived") archivedProject();
        throw new ProjectStageServiceError(
          "NOT_FOUND",
          "Proyecto no encontrado.",
        );
      }
      return result;
    },

    async update(
      actor: ProjectActor,
      projectId: string,
      stageId: string,
      input: UpdateProjectStageInput,
    ) {
      await assertMember(actor);
      await assertProject(actor.organizationId, projectId);
      const values: ProjectStagePatchValues = {};
      if (input.name !== undefined) values.name = input.name.trim();
      if (input.description !== undefined) {
        values.description = normalizeDescription(input.description);
      }
      const result = await store.update(actor, projectId, stageId, values);
      if (result && "status" in result) archivedProject();
      if (!result) {
        throw new ProjectStageServiceError("NOT_FOUND", "Etapa no encontrada.");
      }
      return result;
    },

    async reorder(
      actor: ProjectActor,
      projectId: string,
      input: ReorderProjectStagesInput,
    ) {
      await assertMember(actor);
      await assertProject(actor.organizationId, projectId);
      const current = await store.list(actor.organizationId, projectId);
      if (!hasExactIds(input.stageIds, current)) throw invalidOrder();
      const result = await store.reorder(actor, projectId, input.stageIds);
      if (result && !Array.isArray(result) && "status" in result) {
        archivedProject();
      }
      if (!result) throw invalidOrder();
      return result;
    },

    async remove(actor: ProjectActor, projectId: string, stageId: string) {
      await assertMember(actor);
      await assertProject(actor.organizationId, projectId);
      const result = await store.remove(actor, projectId, stageId);
      if (result === "not_found") {
        throw new ProjectStageServiceError("NOT_FOUND", "Etapa no encontrada.");
      }
      if (result === "in_use") {
        throw new ProjectStageServiceError(
          "CONFLICT",
          "Mueve las tareas de esta etapa antes de eliminarla.",
        );
      }
      if (result === "project_archived") archivedProject();
    },
  };
}

export type ProjectStageService = ReturnType<typeof createProjectStageService>;
