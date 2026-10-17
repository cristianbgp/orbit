import type {
  CasePresentationActor,
  CasePresentationFilters,
  CasePresentationQuery,
  CasePresentationResult,
} from "./case-presentation-types";

export type CasePresentationStore = {
  hasMembership(userId: string, organizationId: string): Promise<boolean>;
  list(
    organizationId: string,
    filters: CasePresentationFilters,
  ): Promise<CasePresentationResult>;
};

export class CasePresentationServiceError extends Error {
  constructor(
    readonly code: "FORBIDDEN",
    message: string,
  ) {
    super(message);
    this.name = "CasePresentationServiceError";
  }
}

function unique<T>(values: T[] | undefined): T[] {
  return [...new Set(values ?? [])];
}

export function createCasePresentationService(store: CasePresentationStore) {
  return {
    async list(
      actor: CasePresentationActor,
      query: CasePresentationQuery,
    ): Promise<CasePresentationResult> {
      if (!(await store.hasMembership(actor.userId, actor.organizationId))) {
        throw new CasePresentationServiceError(
          "FORBIDDEN",
          "No tienes acceso a este estudio.",
        );
      }

      return store.list(actor.organizationId, {
        statuses: unique(query.statuses).length
          ? unique(query.statuses)
          : ["in_progress"],
        clientIds: unique(query.clientIds),
        types: unique(query.types),
        memberUserIds: unique(query.memberUserIds),
        includeCompletedActions: query.includeCompletedActions === true,
        includePastEvents: query.includePastEvents === true,
      });
    },
  };
}

export type CasePresentationService = ReturnType<
  typeof createCasePresentationService
>;
