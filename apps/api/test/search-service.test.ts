import { describe, expect, test, vi } from "vitest";

import {
  createSearchService,
  SearchServiceError,
} from "../src/search/search-service";
import type {
  GlobalSearchResult,
  SearchStore,
} from "../src/search/search-types";

const results: GlobalSearchResult = {
  cases: [],
  projects: [
    {
      id: "project-1",
      name: "Apelación Andina",
      status: "active",
      client: { id: "client-1", name: "Andina S.A." },
    },
  ],
  tasks: [],
  clients: [],
  members: [],
};

function createStore(overrides: Partial<SearchStore> = {}): SearchStore {
  return {
    hasMembership: vi.fn().mockResolvedValue(true),
    search: vi.fn().mockResolvedValue(results),
    ...overrides,
  };
}

describe("global search service", () => {
  test("rejects a user who is not a member of the active organization", async () => {
    const store = createStore({
      hasMembership: vi.fn().mockResolvedValue(false),
    });
    const service = createSearchService(store);

    await expect(
      service.search(
        { userId: "user-1", organizationId: "org-1" },
        { q: "apelación", limit: 5 },
      ),
    ).rejects.toEqual(
      new SearchServiceError("FORBIDDEN", "No tienes acceso a este estudio."),
    );
    expect(store.search).not.toHaveBeenCalled();
  });

  test("searches through the current actor scope with a trimmed query", async () => {
    const store = createStore();
    const service = createSearchService(store);

    const value = await service.search(
      { userId: "user-1", organizationId: "org-1" },
      { q: "  apelación  ", limit: 3 },
    );

    expect(value).toEqual(results);
    expect(store.hasMembership).toHaveBeenCalledWith("user-1", "org-1");
    expect(store.search).toHaveBeenCalledWith(
      { userId: "user-1", organizationId: "org-1" },
      "apelación",
      3,
    );
  });
});
