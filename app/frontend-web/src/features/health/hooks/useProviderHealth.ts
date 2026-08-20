import { useQuery } from "@tanstack/react-query";
import { providerHealthApi } from "../api/provider-health.api";
import { useAuthStore } from "@/store/useAuthStore";

export const PROVIDER_HEALTH_QUERY_KEY = ["provider-health"] as const;

export function useProviderHealth() {
  const status = useAuthStore((state) => state.status);
  const isAuthenticated = status === "authenticated";

  return useQuery({
    queryKey: PROVIDER_HEALTH_QUERY_KEY,
    queryFn: () => providerHealthApi.get(),
    enabled: isAuthenticated,
    staleTime: 60 * 1000,
  });
}
