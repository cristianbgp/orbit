import { describe, expect, test } from "vitest";

import {
  readCasePresentationState,
  writeCasePresentationState,
} from "./case-presentation-state";

describe("Case Presentation URL state", () => {
  test("uses the weekly presentation defaults", () => {
    expect(readCasePresentationState(new URLSearchParams())).toEqual({
      statuses: ["in_progress"],
      clientIds: [],
      types: [],
      memberUserIds: [],
      includeCompletedActions: false,
      includePastEvents: false,
    });
  });

  test("reads repeated supported filters and ignores unknown values", () => {
    const state = readCasePresentationState(
      new URLSearchParams(
        "status=concluded&status=in_progress&status=unknown&type=judicial&type=unknown&client=client-1&member=user-2&includeCompletedActions=true&includePastEvents=true&mode=presentation",
      ),
    );

    expect(state).toEqual({
      statuses: ["concluded", "in_progress"],
      clientIds: ["client-1"],
      types: ["judicial"],
      memberUserIds: ["user-2"],
      includeCompletedActions: true,
      includePastEvents: true,
    });
  });

  test("writes compact state while preserving unrelated parameters", () => {
    const params = new URLSearchParams(
      "source=cases&status=concluded&mode=presentation",
    );

    writeCasePresentationState(params, {
      statuses: ["in_progress"],
      clientIds: ["client-1"],
      types: [],
      memberUserIds: [],
      includeCompletedActions: false,
      includePastEvents: true,
    });

    expect(params.toString()).toBe(
      "source=cases&client=client-1&includePastEvents=true",
    );
  });
});
