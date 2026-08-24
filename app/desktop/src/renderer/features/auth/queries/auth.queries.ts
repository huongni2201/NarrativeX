import { useQuery } from "@tanstack/react-query";
import { authApi } from "../api/auth.api";

export const authQueryKeys = {
  currentUser: ["auth", "current-user"] as const,
};

export function useCurrentUserQuery() {
  return useQuery({
    queryKey: authQueryKeys.currentUser,
    queryFn: authApi.getCurrentUser,
    retry: false,
    staleTime: 60_000,
  });
}
