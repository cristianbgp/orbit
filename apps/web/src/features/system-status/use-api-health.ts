import { useGetHealth } from "@/lib/api/generated/system/system";
import { shouldRetryApiRequest } from "@/lib/api/fetcher";

export function useApiHealth() {
  return useGetHealth({
    query: {
      retry: shouldRetryApiRequest,
      staleTime: 30_000,
    },
  });
}
