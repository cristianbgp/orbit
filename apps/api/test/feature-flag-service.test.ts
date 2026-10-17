import { describe, expect, test, vi } from "vitest";

import {
  createFeatureFlagService,
  FeatureFlagServiceError,
} from "../src/feature-flags/feature-flag-service";
import type { FeatureFlagStore } from "../src/feature-flags/feature-flag-types";

const actor = { userId: "user-1", organizationId: "org-1" };

function createStore(
  overrides: Partial<FeatureFlagStore> = {},
): FeatureFlagStore {
  return {
    hasMembership: vi.fn().mockResolvedValue(true),
    listCandidates: vi.fn().mockResolvedValue([]),
    ...overrides,
  };
}

describe("feature flag service", () => {
  test("prefers the organization override over the global value", async () => {
    const store = createStore({
      listCandidates: vi.fn().mockResolvedValue([
        {
          key: "orbit_help_assistant",
          organizationId: null,
          enabled: false,
        },
        {
          key: "orbit_help_assistant",
          organizationId: "org-1",
          enabled: true,
        },
      ]),
    });
    const service = createFeatureFlagService(store);

    await expect(service.resolveForActor(actor)).resolves.toEqual({
      orbitHelpAssistant: true,
    });
    expect(store.hasMembership).toHaveBeenCalledWith("user-1", "org-1");
    expect(store.listCandidates).toHaveBeenCalledWith("org-1");
  });

  test("uses the global value when the organization has no override", async () => {
    const service = createFeatureFlagService(
      createStore({
        listCandidates: vi.fn().mockResolvedValue([
          {
            key: "orbit_help_assistant",
            organizationId: null,
            enabled: true,
          },
        ]),
      }),
    );

    await expect(service.resolveForActor(actor)).resolves.toEqual({
      orbitHelpAssistant: true,
    });
  });

  test("uses the secure catalog default and ignores unknown stored keys", async () => {
    const service = createFeatureFlagService(
      createStore({
        listCandidates: vi
          .fn()
          .mockResolvedValue([
            { key: "unknown_flag", organizationId: "org-1", enabled: true },
          ]),
      }),
    );

    await expect(service.resolveForActor(actor)).resolves.toEqual({
      orbitHelpAssistant: false,
    });
  });

  test("rejects an actor without active organization membership", async () => {
    const store = createStore({
      hasMembership: vi.fn().mockResolvedValue(false),
    });
    const service = createFeatureFlagService(store);

    await expect(service.resolveForActor(actor)).rejects.toEqual(
      new FeatureFlagServiceError(
        "FORBIDDEN",
        "No tienes acceso a este estudio.",
      ),
    );
    expect(store.listCandidates).not.toHaveBeenCalled();
  });

  test("never converts a store failure into an enabled flag", async () => {
    const failure = new Error("database unavailable");
    const service = createFeatureFlagService(
      createStore({
        listCandidates: vi.fn().mockRejectedValue(failure),
      }),
    );

    await expect(service.resolveForActor(actor)).rejects.toBe(failure);
  });

  test("checks and enforces a registered flag", async () => {
    const service = createFeatureFlagService(
      createStore({
        listCandidates: vi
          .fn()
          .mockResolvedValueOnce([
            {
              key: "orbit_help_assistant",
              organizationId: "org-1",
              enabled: true,
            },
          ])
          .mockResolvedValueOnce([]),
      }),
    );

    await expect(
      service.isEnabled("org-1", "orbit_help_assistant"),
    ).resolves.toBe(true);
    await expect(
      service.assertEnabled("org-1", "orbit_help_assistant"),
    ).rejects.toEqual(
      new FeatureFlagServiceError(
        "FEATURE_DISABLED",
        "Esta función no está habilitada para este estudio.",
      ),
    );
  });
});
