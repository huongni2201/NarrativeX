"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import { useAuthStore } from "@/store/useAuthStore";
import { useStudioStore } from "@/store/useStudioStore";
import type { ApiAuthUser } from "@/types/api";

export function useAuthSessionLifecycle() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const setAuthenticated = useAuthStore((state) => state.setAuthenticated);
  const setUnauthenticated = useAuthStore((state) => state.setUnauthenticated);
  const resetStudioSessionState = useStudioStore((state) => state.resetSessionState);

  const markAuthenticated = useCallback(
    (user: ApiAuthUser) => {
      queryClient.setQueryData(queryKeys.currentUser, user);
      setAuthenticated(user);
    },
    [queryClient, setAuthenticated],
  );

  const clearAuthenticatedSession = useCallback(() => {
    queryClient.clear();
    resetStudioSessionState();
    setUnauthenticated();
    router.replace("/auth");
  }, [queryClient, resetStudioSessionState, router, setUnauthenticated]);

  return { markAuthenticated, clearAuthenticatedSession };
}
