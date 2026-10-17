export type CasePresentationStatus = "in_progress" | "concluded";
export type CasePresentationType =
  "administrative" | "judicial" | "constitutional" | "other";

export type CasePresentationState = {
  statuses: CasePresentationStatus[];
  clientIds: string[];
  types: CasePresentationType[];
  memberUserIds: string[];
  includeCompletedActions: boolean;
  includePastEvents: boolean;
};

const statuses = new Set<CasePresentationStatus>(["in_progress", "concluded"]);
const types = new Set<CasePresentationType>([
  "administrative",
  "judicial",
  "constitutional",
  "other",
]);

function unique(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function readBoolean(params: URLSearchParams, key: string) {
  return params.get(key) === "true";
}

export function readCasePresentationState(
  params: URLSearchParams,
): CasePresentationState {
  const requestedStatuses = unique(params.getAll("status")).filter((value) =>
    statuses.has(value as CasePresentationStatus),
  ) as CasePresentationStatus[];
  return {
    statuses: requestedStatuses.length ? requestedStatuses : ["in_progress"],
    clientIds: unique(params.getAll("client")),
    types: unique(params.getAll("type")).filter((value) =>
      types.has(value as CasePresentationType),
    ) as CasePresentationType[],
    memberUserIds: unique(params.getAll("member")),
    includeCompletedActions: readBoolean(params, "includeCompletedActions"),
    includePastEvents: readBoolean(params, "includePastEvents"),
  };
}

function replace(params: URLSearchParams, key: string, values: string[]) {
  params.delete(key);
  for (const value of unique(values)) params.append(key, value);
}

export function writeCasePresentationState(
  params: URLSearchParams,
  state: CasePresentationState,
) {
  replace(
    params,
    "status",
    state.statuses.length === 1 && state.statuses[0] === "in_progress"
      ? []
      : state.statuses,
  );
  replace(params, "client", state.clientIds);
  replace(params, "type", state.types);
  replace(params, "member", state.memberUserIds);
  for (const [key, enabled] of [
    ["includeCompletedActions", state.includeCompletedActions],
    ["includePastEvents", state.includePastEvents],
  ] as const) {
    if (enabled) params.set(key, "true");
    else params.delete(key);
  }
  params.delete("mode");
}
