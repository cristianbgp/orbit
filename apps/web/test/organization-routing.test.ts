import { describe, expect, test } from "vitest";

import { selectCurrentOrganization } from "@/features/organization/organization-routing";

const organizations = [
  { id: "org-b", name: "Beta", timeZone: "UTC" },
  { id: "org-a", name: "Alpha", timeZone: "America/Lima" },
];

describe("selectCurrentOrganization", () => {
  test("returns null for no memberships", () => {
    expect(selectCurrentOrganization([], null)).toBeNull();
  });

  test("prefers the active organization", () => {
    expect(selectCurrentOrganization(organizations, "org-b")?.id).toBe("org-b");
  });

  test("uses the lowest stable id when active state is missing", () => {
    expect(selectCurrentOrganization(organizations, null)?.id).toBe("org-a");
  });
});
