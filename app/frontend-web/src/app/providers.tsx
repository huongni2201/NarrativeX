"use client";

import { QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { createQueryClient } from "@/lib/query-client";
import { api, ApiClientError } from "@/lib/api";
import { useAuthStore } from "@/store/useAuthStore";

function AuthBootstrap({ children }: Readonly<{ children: React.ReactNode }>) {
  const setAuthenticated = useAuthStore((state) => state.setAuthenticated);
  const setUnauthenticated = useAuthStore((state) => state.setUnauthenticated);
  const setBootstrapError = useAuthStore((state) => state.setBootstrapError);

  useEffect(() => {
    let cancelled = false;

    api.getCurrentUser()
      .then((user) => {
        if (!cancelled) setAuthenticated(user);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        if (error instanceof ApiClientError && error.status === 401) {
          setUnauthenticated();
          return;
        }
        setBootstrapError("Không thể kiểm tra phiên đăng nhập. Vui lòng thử lại.");
      });

    return () => {
      cancelled = true;
    };
  }, [setAuthenticated, setBootstrapError, setUnauthenticated]);

  return children;
}

export function AppProviders({ children }: Readonly<{ children: React.ReactNode }>) {
  const [queryClient] = useState(createQueryClient);

  return (
    <QueryClientProvider client={queryClient}>
      <AuthBootstrap>{children}</AuthBootstrap>
    </QueryClientProvider>
  );
}
