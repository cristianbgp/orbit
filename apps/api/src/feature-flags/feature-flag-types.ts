import type {
  FeatureFlagClientKey,
  FeatureFlagKey,
} from "./feature-flag-catalog";

export type FeatureFlagActor = {
  userId: string;
  organizationId: string;
};

export type StoredFeatureFlag = {
  key: string;
  organizationId: string | null;
  enabled: boolean;
};

export type ClientFeatureFlags = Record<FeatureFlagClientKey, boolean>;

export type FeatureFlagStore = {
  hasMembership(userId: string, organizationId: string): Promise<boolean>;
  listCandidates(organizationId: string): Promise<StoredFeatureFlag[]>;
};

export type FeatureFlagService = {
  resolveForActor(actor: FeatureFlagActor): Promise<ClientFeatureFlags>;
  isEnabled(organizationId: string, key: FeatureFlagKey): Promise<boolean>;
  assertEnabled(organizationId: string, key: FeatureFlagKey): Promise<void>;
};
