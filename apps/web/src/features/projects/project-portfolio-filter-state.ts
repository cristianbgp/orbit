import type { ProjectStatus, ProjectType } from "@/lib/api/generated/models";

export type ProjectPortfolioFilters = {
  statuses: ProjectStatus[];
  types: ProjectType[];
  clientIds: string[];
  memberUserIds: string[];
};

const statuses = new Set<ProjectStatus>(["draft", "active", "completed"]);
const types = new Set<ProjectType>([
  "written_submission",
  "consultation",
  "oral_argument",
  "other",
]);

function unique(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

export function readProjectPortfolioFilters(
  searchParams: URLSearchParams,
): ProjectPortfolioFilters {
  return {
    statuses: unique(searchParams.getAll("status")).filter((value) =>
      statuses.has(value as ProjectStatus),
    ) as ProjectStatus[],
    types: unique(searchParams.getAll("type")).filter((value) =>
      types.has(value as ProjectType),
    ) as ProjectType[],
    clientIds: unique(searchParams.getAll("client")),
    memberUserIds: unique(searchParams.getAll("member")),
  };
}

export function replaceRepeatedParam(
  searchParams: URLSearchParams,
  key: "status" | "type" | "client" | "member",
  values: string[],
) {
  searchParams.delete(key);
  for (const value of unique(values)) searchParams.append(key, value);
}

export function countActiveProjectFilters(filters: ProjectPortfolioFilters) {
  return [
    filters.statuses,
    filters.types,
    filters.clientIds,
    filters.memberUserIds,
  ].filter((values) => values.length > 0).length;
}
