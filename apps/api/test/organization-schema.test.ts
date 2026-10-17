import { describe, expect, test } from "vitest";

import {
  invitation,
  member,
  organization,
  session,
} from "../src/db/auth-schema";

describe("organization auth schema", () => {
  test("exports the organization plugin tables and active session field", () => {
    expect(organization.id).toBeDefined();
    expect(organization.timeZone.notNull).toBe(true);
    expect(organization.timeZone.default).toBe("America/Lima");
    expect(member.organizationId).toBeDefined();
    expect(member.userId).toBeDefined();
    expect(invitation.organizationId).toBeDefined();
    expect(session.activeOrganizationId).toBeDefined();
  });
});
