import { useQuery } from "@tanstack/react-query";
import { userQuotaApi } from "../api/user-quota.api";
import { useAuthStore } from "@/store/useAuthStore";

export const USER_QUOTA_QUERY_KEY = ["user-quota"] as const;

export function useUserQuota() {
  const status = useAuthStore((state) => state.status);
  const isAuthenticated = status === "authenticated";

  return useQuery({
    queryKey: USER_QUOTA_QUERY_KEY,
    queryFn: () => userQuotaApi.get(),
    enabled: isAuthenticated,
    staleTime: 60 * 1000,
  });
}
