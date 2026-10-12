import type { FeatureFlagService } from "../../src/feature-flags/feature-flag-types";

export const testFeatureFlagService: FeatureFlagService = {
  async resolveForActor() {
    return { orbitHelpAssistant: false };
  },
  async isEnabled() {
    return false;
  },
  async assertEnabled() {},
};
