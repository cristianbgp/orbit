import type { SearchService, SearchStore } from "./search-types";

export type SearchServiceErrorCode = "FORBIDDEN";

export class SearchServiceError extends Error {
  readonly code: SearchServiceErrorCode;

  constructor(code: SearchServiceErrorCode, message: string) {
    super(message);
    this.name = "SearchServiceError";
    this.code = code;
  }
}

export function createSearchService(store: SearchStore): SearchService {
  return {
    async search(actor, input) {
      const isMember = await store.hasMembership(
        actor.userId,
        actor.organizationId,
      );
      if (!isMember) {
        throw new SearchServiceError(
          "FORBIDDEN",
          "No tienes acceso a este estudio.",
        );
      }

      return store.search(
        { userId: actor.userId, organizationId: actor.organizationId },
        input.q.trim(),
        input.limit,
      );
    },
  };
}
