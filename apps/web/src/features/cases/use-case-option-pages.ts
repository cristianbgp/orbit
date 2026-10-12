import { useQuery } from "@tanstack/react-query";

import { listClients } from "@/lib/api/generated/clients/clients";
import { listTeamMembers } from "@/lib/api/generated/team/team";

type PaginatedItems<T> = {
  items: T[];
  pagination: { totalPages: number };
};

export async function collectPaginatedItems<T>(
  fetchPage: (page: number) => Promise<PaginatedItems<T>>,
) {
  const first = await fetchPage(1);
  const items = [...first.items];
  for (let page = 2; page <= first.pagination.totalPages; page += 1) {
    const next = await fetchPage(page);
    items.push(...next.items);
  }
  return items;
}

export function useAllCaseClients() {
  return useQuery({
    queryKey: ["case-option-pages", "clients"],
    queryFn: ({ signal }) =>
      collectPaginatedItems(async (page) => {
        const response = await listClients({ page, pageSize: 100 }, { signal });
        return { items: response.clients, pagination: response.pagination };
      }),
    staleTime: 5 * 60 * 1_000,
  });
}

export function useAllCaseMembers(search = "") {
  return useQuery({
    queryKey: ["case-option-pages", "members", search],
    queryFn: ({ signal }) =>
      collectPaginatedItems(async (page) => {
        const response = await listTeamMembers(
          { page, pageSize: 100, ...(search ? { q: search } : {}) },
          { signal },
        );
        return { items: response.members, pagination: response.pagination };
      }),
    staleTime: 60 * 1_000,
  });
}
