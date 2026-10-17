import type { OrganizationSummary } from "./organization-types";

export function selectCurrentOrganization(
  organizations: OrganizationSummary[],
  activeOrganizationId: string | null | undefined,
) {
  const active = organizations.find(
    (organization) => organization.id === activeOrganizationId,
  );

  return (
    active ??
    [...organizations].sort((left, right) =>
      left.id.localeCompare(right.id),
    )[0] ??
    null
  );
}
