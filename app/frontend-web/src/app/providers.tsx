"use client";

import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import { useEffect, useState } from "react";
import { createQueryClient } from "@/lib/query-client";
import { authApi } from "@/features/auth/api/auth.api";
import { useAuthSessionLifecycle } from "@/features/auth/hooks/useAuthSessionLifecycle";
import { ApiClientError, subscribeUnauthorized } from "@/shared/api/client";
import { useAuthStore } from "@/store/useAuthStore";

function AuthBootstrap({ children }: Readonly<{ children: React.ReactNode }>) {
  const { markAuthenticated, clearAuthenticatedSession } = useAuthSessionLifecycle();
  const setBootstrapError = useAuthStore((state) => state.setBootstrapError);

  useEffect(
    () => subscribeUnauthorized(clearAuthenticatedSession),
    [clearAuthenticatedSession],
  );

  useEffect(() => {
    let cancelled = false;

    authApi
      .getCurrentUser()
      .then((user) => {
        if (!cancelled) markAuthenticated(user);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        if (error instanceof ApiClientError && error.status === 401) {
          clearAuthenticatedSession();
          return;
        }
        setBootstrapError("Không thể kiểm tra phiên đăng nhập. Vui lòng thử lại.");
      });

    return () => {
      cancelled = true;
    };
  }, [clearAuthenticatedSession, markAuthenticated, setBootstrapError]);

  return children;
}

export function AppProviders({ children }: Readonly<{ children: React.ReactNode }>) {
  const [queryClient] = useState(createQueryClient);

  return (
    <QueryClientProvider client={queryClient}>
      <AuthBootstrap>
        {children}
        <Toaster
          position="top-right"
          theme="light"
          richColors
          closeButton
          toastOptions={{
            classNames: {
              toast: "!border-border-toast !bg-surface-toast !text-text-toast shadow-xl",
              title: "!text-text-toast",
              description: "!text-text-toast-muted",
              closeButton: "!border-border-toast !bg-surface-toast-hover !text-text-toast-muted",
            },
          }}
        />
      </AuthBootstrap>
    </QueryClientProvider>
  );
}
