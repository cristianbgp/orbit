import {
  featureFlagCatalog,
  isFeatureFlagKey,
  type FeatureFlagKey,
} from "./feature-flag-catalog";
import type {
  ClientFeatureFlags,
  FeatureFlagService,
  FeatureFlagStore,
  StoredFeatureFlag,
} from "./feature-flag-types";

export type FeatureFlagServiceErrorCode = "FORBIDDEN" | "FEATURE_DISABLED";

export class FeatureFlagServiceError extends Error {
  readonly code: FeatureFlagServiceErrorCode;

  constructor(code: FeatureFlagServiceErrorCode, message: string) {
    super(message);
    this.name = "FeatureFlagServiceError";
    this.code = code;
  }
}

function resolveFlag(
  rows: StoredFeatureFlag[],
  organizationId: string,
  key: FeatureFlagKey,
) {
  const organizationValue = rows.find(
    (row) => row.key === key && row.organizationId === organizationId,
  );
  if (organizationValue) return organizationValue.enabled;

  const globalValue = rows.find(
    (row) => row.key === key && row.organizationId === null,
  );
  return globalValue?.enabled ?? featureFlagCatalog[key].defaultEnabled;
}

function resolveClientFlags(
  rows: StoredFeatureFlag[],
  organizationId: string,
): ClientFeatureFlags {
  const result: ClientFeatureFlags = { orbitHelpAssistant: false };

  for (const key of Object.keys(featureFlagCatalog)) {
    if (!isFeatureFlagKey(key)) continue;
    const definition = featureFlagCatalog[key];
    result[definition.clientKey] = resolveFlag(rows, organizationId, key);
  }

  return result;
}

export function createFeatureFlagService(
  store: FeatureFlagStore,
): FeatureFlagService {
  async function isEnabled(organizationId: string, key: FeatureFlagKey) {
    const rows = await store.listCandidates(organizationId);
    return resolveFlag(rows, organizationId, key);
  }

  return {
    async resolveForActor(actor) {
      if (!(await store.hasMembership(actor.userId, actor.organizationId))) {
        throw new FeatureFlagServiceError(
          "FORBIDDEN",
          "No tienes acceso a este estudio.",
        );
      }

      const rows = await store.listCandidates(actor.organizationId);
      return resolveClientFlags(rows, actor.organizationId);
    },

    isEnabled,

    async assertEnabled(organizationId, key) {
      if (!(await isEnabled(organizationId, key))) {
        throw new FeatureFlagServiceError(
          "FEATURE_DISABLED",
          "Esta función no está habilitada para este estudio.",
        );
      }
    },
  };
}
