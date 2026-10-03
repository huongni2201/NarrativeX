import { useQuery } from "@tanstack/react-query";
import { runtimeCapabilitiesApi } from "../api/runtime-capabilities.api.ts";
import { DEFAULT_FALLBACK_CAPABILITY } from "../model/runtime-capabilities.ts";

export const RUNTIME_CAPABILITIES_QUERY_KEY = ["runtime", "capabilities"] as const;

export function useRuntimeCapabilities() {
  const query = useQuery({
    queryKey: RUNTIME_CAPABILITIES_QUERY_KEY,
    queryFn: () => runtimeCapabilitiesApi.getCapabilities(),
    staleTime: 60_000,
  });

  const videoCapability = query.data?.videoGeneration ?? DEFAULT_FALLBACK_CAPABILITY;

  return {
    ...query,
    capabilities: query.data,
    videoCapability,
    isAvailable: videoCapability.available && query.isSuccess,
    status: videoCapability.status ?? "UNAVAILABLE",
    supportedStrategies: videoCapability.strategies,
    supportedAspectRatios: videoCapability.supportedAspectRatios,
  };
}
