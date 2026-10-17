export type CaseTypeFilter =
  "administrative" | "judicial" | "constitutional" | "other";

export type CasePortfolioFilters = {
  types: CaseTypeFilter[];
  clientIds: string[];
  memberUserIds: string[];
};

const caseTypes = new Set<CaseTypeFilter>([
  "administrative",
  "judicial",
  "constitutional",
  "other",
]);

function unique(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

export function readCasePortfolioFilters(
  searchParams: URLSearchParams,
): CasePortfolioFilters {
  return {
    types: unique(searchParams.getAll("type")).filter((value) =>
      caseTypes.has(value as CaseTypeFilter),
    ) as CaseTypeFilter[],
    clientIds: unique(searchParams.getAll("client")),
    memberUserIds: unique(searchParams.getAll("member")),
  };
}

export function replaceCaseFilterParam(
  searchParams: URLSearchParams,
  key: "type" | "client" | "member",
  values: string[],
) {
  searchParams.delete(key);
  for (const value of unique(values)) searchParams.append(key, value);
}

export function countActiveCaseFilters(filters: CasePortfolioFilters) {
  return [filters.types, filters.clientIds, filters.memberUserIds].filter(
    (values) => values.length > 0,
  ).length;
}
