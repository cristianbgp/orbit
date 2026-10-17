import { describe, expect, test } from "vitest";

import {
  CasePresentationServiceError,
  createCasePresentationService,
  type CasePresentationStore,
} from "../src/case-presentation/case-presentation-service";

const actor = { userId: "user-1", organizationId: "org-1" };

function createStore(
  overrides: Partial<CasePresentationStore> = {},
): CasePresentationStore {
  return {
    hasMembership: async () => true,
    list: async () => ({
      generatedAt: new Date("2026-09-04T12:00:00.000Z"),
      organizationDate: "2026-09-04",
      clients: [],
      truncated: { value: false, scopes: [] },
    }),
    ...overrides,
  };
}

describe("Case presentation service", () => {
  test("normalizes the initial weekly presentation filters", async () => {
    let received: Parameters<CasePresentationStore["list"]>[1] | undefined;
    const store = createStore({
      list: async (_organizationId, filters) => {
        received = filters;
        return {
          generatedAt: new Date("2026-09-04T12:00:00.000Z"),
          organizationDate: "2026-09-04",
          clients: [],
          truncated: { value: false, scopes: [] },
        };
      },
    });
    const service = createCasePresentationService(store);

    await service.list(actor, {});
    expect(received).toEqual({
      statuses: ["in_progress"],
      clientIds: [],
      types: [],
      memberUserIds: [],
      includeCompletedActions: false,
      includePastEvents: false,
    });
  });

  test("preserves supported multi-value filters and inclusion toggles", async () => {
    let received: Parameters<CasePresentationStore["list"]>[1] | undefined;
    const service = createCasePresentationService(
      createStore({
        list: async (_organizationId, filters) => {
          received = filters;
          return {
            generatedAt: new Date("2026-09-04T12:00:00.000Z"),
            organizationDate: "2026-09-04",
            clients: [],
            truncated: { value: false, scopes: [] },
          };
        },
      }),
    );

    await service.list(actor, {
      statuses: ["concluded", "in_progress", "concluded"],
      clientIds: ["client-2", "client-1", "client-2"],
      types: ["judicial", "administrative", "judicial"],
      memberUserIds: ["user-2", "user-2"],
      includeCompletedActions: true,
      includePastEvents: true,
    });
    expect(received).toEqual({
      statuses: ["concluded", "in_progress"],
      clientIds: ["client-2", "client-1"],
      types: ["judicial", "administrative"],
      memberUserIds: ["user-2"],
      includeCompletedActions: true,
      includePastEvents: true,
    });
  });

  test("rejects actors without an active studio membership", async () => {
    const service = createCasePresentationService(
      createStore({ hasMembership: async () => false }),
    );

    await expect(service.list(actor, {})).rejects.toMatchObject({
      code: "FORBIDDEN",
    } satisfies Partial<CasePresentationServiceError>);
  });
});
