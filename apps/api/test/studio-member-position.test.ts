import { describe, expect, test } from "vitest";

describe("studio member position", () => {
  test("exposes the fixed professional catalog and Spanish labels", async () => {
    const position = await import("../src/identity/studio-member-position");

    expect(position.STUDIO_MEMBER_POSITIONS).toEqual([
      "partner",
      "senior",
      "junior",
      "assistant",
      "intern",
    ]);
    expect(position.STUDIO_MEMBER_POSITION_LABELS).toEqual({
      partner: "Socio",
      senior: "Senior",
      junior: "Junior",
      assistant: "Asistente",
      intern: "Practicante",
    });
    expect(position.isStudioMemberPosition("senior")).toBe(true);
    expect(position.isStudioMemberPosition("owner")).toBe(false);
  });
});
