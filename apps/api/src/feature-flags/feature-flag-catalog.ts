export const featureFlagCatalog = {
  orbit_help_assistant: {
    clientKey: "orbitHelpAssistant",
    defaultEnabled: false,
  },
} as const;

export type FeatureFlagKey = keyof typeof featureFlagCatalog;
export type FeatureFlagClientKey =
  (typeof featureFlagCatalog)[FeatureFlagKey]["clientKey"];

export function isFeatureFlagKey(value: string): value is FeatureFlagKey {
  return value in featureFlagCatalog;
}
