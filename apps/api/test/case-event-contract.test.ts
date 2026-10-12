import { describe, expect, test } from "vitest";

import {
  CaseEventInputSchema,
  CaseEventTypeSchema,
} from "../src/contracts/case-events";

describe("case event contract", () => {
  test.each(["oral_argument", "interview", "other"] as const)(
    "accepts the %s event type",
    (type) => {
      expect(CaseEventTypeSchema.safeParse(type).success).toBe(true);
      expect(
        CaseEventInputSchema.safeParse({
          title: "Evento del caso",
          type,
          date: "2026-09-18",
        }).success,
      ).toBe(true);
    },
  );
});
