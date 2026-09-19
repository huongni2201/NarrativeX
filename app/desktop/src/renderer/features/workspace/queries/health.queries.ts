import { useQuery } from "@tanstack/react-query";
import type { DesktopProviderHealth } from "@narrativex/client-contracts";
import { healthApi } from "../api/health.api.ts";

export const healthQueryKeys = {
  all: ["health"] as const,
  provider: () => [...healthQueryKeys.all, "provider"] as const,
};

export function useProviderHealthQuery() {
  return useQuery<DesktopProviderHealth>({
    queryKey: healthQueryKeys.provider(),
    queryFn: () => healthApi.getProviderHealth(),
    refetchInterval: 30_000,
    staleTime: 15_000,
  });
}