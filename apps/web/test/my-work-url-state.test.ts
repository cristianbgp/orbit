import { describe, expect, test } from "vitest";

import { readMyWorkUrlState } from "@/features/my-work/my-work-url-state";

describe("my work URL state", () => {
  test("normalizes repeated filters, pages, expansion and selected task", () => {
    const state = readMyWorkUrlState(
      new URLSearchParams(
        "view=supervision&q=+demanda+&project=p2&project=p1&project=p2&status=blocked&status=bad&from=2026-08-01&to=2026-08-20&completed=1&assignedPage=2&supervisionPage=3&expanded=p1&expandedPage=4&task=t1&taskProject=p1",
      ),
    );
    expect(state).toEqual({
      view: "supervision",
      search: "demanda",
      projectIds: ["p1", "p2"],
      statuses: ["blocked"],
      dateFrom: "2026-08-01",
      dateTo: "2026-08-20",
      includeCompleted: true,
      assignedPage: 2,
      supervisionPage: 3,
      actionPage: 1,
      caseClientIds: [],
      caseIds: [],
      caseTypes: [],
      includeCompletedActions: false,
      expandedProjectId: "p1",
      expandedPage: 4,
      taskId: "t1",
      taskProjectId: "p1",
    });
  });

  test("falls back safely for malformed values", () => {
    expect(
      readMyWorkUrlState(
        new URLSearchParams(
          "assignedPage=0&supervisionPage=no&from=bad&task=t1",
        ),
      ),
    ).toMatchObject({
      view: "tasks",
      assignedPage: 1,
      supervisionPage: 1,
      dateFrom: "",
      taskId: null,
      taskProjectId: null,
    });
  });

  test("normalizes an unknown view to assigned tasks", () => {
    expect(readMyWorkUrlState(new URLSearchParams("view=unknown")).view).toBe(
      "tasks",
    );
  });
});
