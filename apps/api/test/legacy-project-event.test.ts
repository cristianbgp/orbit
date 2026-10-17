import { describe, expect, test } from "vitest";

import { legacyProjectLegalEventId } from "../src/project-events/legacy-project-event";

describe("legacy project event compatibility", () => {
  test("uses the migration-compatible deterministic legal event id", () => {
    expect(legacyProjectLegalEventId("project-1")).toBe(
      "legacy-legal:project-1",
    );
  });
});
