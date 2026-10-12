import { useState } from "react";

import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useSearchGlobally } from "@/lib/api/generated/search/search";

const SEARCH_LIMIT = 5;

export function useGlobalSearch(identity: {
  userId: string;
  organizationId: string;
}) {
  const [query, setQuery] = useState("");
  const normalizedQuery = query.trim();
  const debouncedQuery = useDebouncedValue(normalizedQuery, 300);
  const enabled = debouncedQuery.length >= 2;
  const searchQuery = useSearchGlobally(
    { q: debouncedQuery, limit: SEARCH_LIMIT },
    {
      query: {
        enabled,
        queryKey: [
          "/api/search",
          { q: debouncedQuery, limit: SEARCH_LIMIT },
          identity,
        ],
      },
    },
  );

  return {
    query,
    setQuery,
    normalizedQuery,
    debouncedQuery,
    enabled,
    isCurrentQuery: normalizedQuery === debouncedQuery,
    searchQuery,
  };
}
