import type { SearchService } from "../../src/search/search-types";

export const testSearchService: SearchService = {
  async search() {
    return { cases: [], projects: [], tasks: [], clients: [], members: [] };
  },
};
