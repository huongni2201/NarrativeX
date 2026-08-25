import { useEffect, useState, type PropsWithChildren } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { apiBaseUrl, DesktopApiError } from "../../api/client";
import { authApi } from "./api/auth.api";
import { LoginScreen } from "./components/LoginScreen";
import { authQueryKeys, useCurrentUserQuery } from "./queries/auth.queries";
import "./auth.css";

export function AuthGuard({ children }: PropsWithChildren) {
  const queryClient = useQueryClient();
  const currentUser = useCurrentUserQuery();
  const [exchangeError, setExchangeError] = useState<string | null>(null);
  const [boundLocalUserId, setBoundLocalUserId] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    if (!window.narrativex?.auth) return;
    const unsubscribe = window.narrativex.auth.onCallback((response) => {
      void authApi.exchange(response)
        .then((user) => {
          setExchangeError(null);
          queryClient.setQueryData(authQueryKeys.currentUser, user);
        })
        .catch((reason) => {
          setExchangeError(reason instanceof Error ? reason.message : "Mã đăng nhập không hợp lệ.");
        });
    });
    return unsubscribe;
  }, [queryClient]);

  const currentUserId = currentUser.data?.id ?? null;
  useEffect(() => {
    if (currentUser.isPending) return;
    if (!window.narrativex?.localExecution) {
      setBoundLocalUserId(currentUserId);
      return;
    }

    let cancelled = false;
    setBoundLocalUserId(undefined);
    void window.narrativex.localExecution
      .setUser(currentUserId)
      .then(() => {
        if (!cancelled) setBoundLocalUserId(currentUserId);
      })
      .catch((error) => {
        // Local execution is optional for browsing/editing. The main process already
        // deactivates mismatched identities before a failed disk cleanup can surface.
        console.error("Failed to bind local execution to the current user", error);
        if (!cancelled) setBoundLocalUserId(currentUserId);
      });
    return () => {
      cancelled = true;
    };
  }, [currentUser.isPending, currentUserId]);

  if (currentUser.isPending) {
    return <main className="auth-screen"><div className="auth-loading">Đang kiểm tra phiên NarrativeX…</div></main>;
  }
  if (currentUser.data && boundLocalUserId !== currentUser.data.id) {
    return <main className="auth-screen"><div className="auth-loading">Đang đồng bộ local executor…</div></main>;
  }
  if (currentUser.data) return <>{children}</>;

  const queryError = currentUser.error instanceof DesktopApiError && currentUser.error.status !== 401
    ? `${currentUser.error.message} (${currentUser.error.status})`
    : currentUser.error instanceof Error ? currentUser.error.message : undefined;
  return <LoginScreen onLogin={() => {
    if (!window.narrativex?.auth) return Promise.reject(new Error("Login chỉ khả dụng trong Electron Desktop."));
    return window.narrativex.auth.login();
  }} error={exchangeError ?? queryError ?? `Backend: ${apiBaseUrl()}`} />;
}
