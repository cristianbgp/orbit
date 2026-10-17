import { describe, expect, test } from "vitest";

import { deriveProjectStageStatus } from "@/features/projects/project-stage-status";

describe("deriveProjectStageStatus", () => {
  test.each([
    {
      counts: { pending: 0, inProgress: 0, blocked: 0, completed: 0 },
      expected: "empty",
    },
    {
      counts: { pending: 3, inProgress: 0, blocked: 0, completed: 0 },
      expected: "pending",
    },
    {
      counts: { pending: 1, inProgress: 1, blocked: 0, completed: 0 },
      expected: "in_progress",
    },
    {
      counts: { pending: 1, inProgress: 0, blocked: 0, completed: 1 },
      expected: "in_progress",
    },
    {
      counts: { pending: 0, inProgress: 1, blocked: 1, completed: 2 },
      expected: "blocked",
    },
    {
      counts: { pending: 0, inProgress: 0, blocked: 0, completed: 4 },
      expected: "completed",
    },
  ])("returns $expected for $counts", ({ counts, expected }) => {
    expect(deriveProjectStageStatus(counts)).toBe(expected);
  });
});
