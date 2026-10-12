import { useGetFeatureFlags } from "@/lib/api/generated/feature-flags/feature-flags";
import type { FeatureFlagsResponse } from "@/lib/api/generated/models";

const FEATURE_FLAGS_STALE_TIME = 5 * 60 * 1000;

export type FeatureFlagClientKey = keyof FeatureFlagsResponse["features"];

export function useFeatureFlagsQuery(identity: {
  userId: string;
  organizationId: string;
}) {
  return useGetFeatureFlags({
    query: {
      queryKey: ["/api/features", identity],
      staleTime: FEATURE_FLAGS_STALE_TIME,
    },
  });
}

export function useFeatureFlag(
  key: FeatureFlagClientKey,
  identity: { userId: string; organizationId: string },
) {
  const query = useFeatureFlagsQuery(identity);

  if (query.isPending || query.isError) return false;
  return query.data?.features[key] === true;
}
