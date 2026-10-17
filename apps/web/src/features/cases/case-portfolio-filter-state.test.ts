import { describe, expect, test } from "vitest";

import {
  countActiveCaseFilters,
  readCasePortfolioFilters,
  replaceCaseFilterParam,
} from "./case-portfolio-filter-state";

describe("case portfolio filter state", () => {
  test("reads valid repeated filters and removes duplicates", () => {
    const params = new URLSearchParams(
      "type=administrative&type=judicial&type=unknown&client=client-1&client=client-1&member=user-1",
    );

    expect(readCasePortfolioFilters(params)).toEqual({
      types: ["administrative", "judicial"],
      clientIds: ["client-1"],
      memberUserIds: ["user-1"],
    });
  });

  test("writes repeated filters without affecting other properties", () => {
    const params = new URLSearchParams("view=concluded&client=old");

    replaceCaseFilterParam(params, "client", ["client-1", "client-2"]);

    expect(params.toString()).toBe(
      "view=concluded&client=client-1&client=client-2",
    );
  });

  test("counts active properties instead of individual selections", () => {
    expect(
      countActiveCaseFilters({
        types: ["administrative", "judicial"],
        clientIds: ["client-1"],
        memberUserIds: [],
      }),
    ).toBe(2);
  });
});
