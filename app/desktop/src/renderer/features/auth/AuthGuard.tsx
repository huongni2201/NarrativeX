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

  useEffect(() => {
    if (!window.narrativex?.auth) return;
    const unsubscribe = window.narrativex.auth.onCallback((code) => {
      void authApi.exchange(code)
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

  if (currentUser.isPending) return <main className="auth-screen"><div className="auth-loading">Đang kiểm tra phiên NarrativeX…</div></main>;
  if (currentUser.data) return <>{children}</>;

  const queryError = currentUser.error instanceof DesktopApiError && currentUser.error.status !== 401
    ? `${currentUser.error.message} (${currentUser.error.status})`
    : currentUser.error instanceof Error ? currentUser.error.message : undefined;
  return <LoginScreen onLogin={() => {
    if (!window.narrativex?.auth) return Promise.reject(new Error("Login chỉ khả dụng trong Electron Desktop."));
    return window.narrativex.auth.login();
  }} error={exchangeError ?? queryError ?? `Backend: ${apiBaseUrl()}`} />;
}
