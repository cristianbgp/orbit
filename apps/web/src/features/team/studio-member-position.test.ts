import { describe, expect, test } from "vitest";

import { groupStudioMembersByPosition } from "./studio-member-position";

describe("groupStudioMembersByPosition", () => {
  test("groups members in the studio position order and omits empty groups", () => {
    const members = [
      { id: "without-position", position: null },
      { id: "unknown-position", position: "legacy-position" },
      { id: "senior", position: "senior" },
      { id: "partner", position: "partner" },
    ];

    expect(
      groupStudioMembersByPosition(members, (member) => member.position).map(
        (group) => ({
          label: group.label,
          members: group.members.map((member) => member.id),
        }),
      ),
    ).toEqual([
      { label: "Socio", members: ["partner"] },
      { label: "Senior", members: ["senior"] },
      {
        label: "Sin posición",
        members: ["without-position", "unknown-position"],
      },
    ]);
  });
});
