import { describe, expect, test } from "vitest";

import { getInvitationId } from "@/features/invitations/invitation-routing";

describe("getInvitationId", () => {
  test("extracts and decodes one exact invitation path segment", () => {
    expect(getInvitationId("/invitations/invitation-1")).toBe("invitation-1");
    expect(getInvitationId("/invitations/invitation%202")).toBe("invitation 2");
  });

  test("rejects incomplete, unrelated, nested, or invalid paths", () => {
    expect(getInvitationId("/invitations/")).toBeNull();
    expect(getInvitationId("/projects/invitation-1")).toBeNull();
    expect(getInvitationId("/invitations/a/b")).toBeNull();
    expect(getInvitationId("/invitations/%E0%A4%A")).toBeNull();
  });
});
