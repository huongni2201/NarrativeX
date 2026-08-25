import { useEffect, useRef, useState, type PropsWithChildren } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { DesktopApiError } from "../../api/client";
import { authApi } from "./api/auth.api";
import { LoginModal } from "./components/LoginModal";
import { authQueryKeys, useCurrentUserQuery } from "./queries/auth.queries";
import "./auth.css";

const AUTH_REQUIRED_EVENT = "narrativex:auth-required";

interface AuthRequiredDetail {
  reason?: string;
  path?: string;
}

export function AuthGuard({ children }: PropsWithChildren) {
  const queryClient = useQueryClient();
  const currentUser = useCurrentUserQuery();
  const guestBootstrapStarted = useRef(false);
  const [exchangeError, setExchangeError] = useState<string | null>(null);
  const [bootstrapError, setBootstrapError] = useState<string | null>(null);
  const [guestBootstrapPending, setGuestBootstrapPending] = useState(false);
  const [loginReason, setLoginReason] = useState<string | null>(null);
  const [boundLocalUserId, setBoundLocalUserId] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    const handleAuthRequired = (event: Event) => {
      const detail = (event as CustomEvent<AuthRequiredDetail>).detail;
      setExchangeError(null);
      setLoginReason(detail?.reason ?? "Đăng nhập để sử dụng tính năng này.");
    };
    window.addEventListener(AUTH_REQUIRED_EVENT, handleAuthRequired);
    return () => window.removeEventListener(AUTH_REQUIRED_EVENT, handleAuthRequired);
  }, []);

  const needsGuestBootstrap =
    currentUser.error instanceof DesktopApiError && currentUser.error.status === 401;

  useEffect(() => {
    if (!needsGuestBootstrap || guestBootstrapStarted.current) return;
    guestBootstrapStarted.current = true;
    setGuestBootstrapPending(true);
    setBootstrapError(null);
    void authApi.ensureGuestSession()
      .then(async (user) => {
        queryClient.setQueryData(authQueryKeys.currentUser, user);
        await queryClient.invalidateQueries({
          predicate: (query) => query.queryKey[0] !== "auth",
        });
      })
      .catch((reason) => {
        setBootstrapError(
          reason instanceof Error ? reason.message : "Không thể tạo guest session.",
        );
      })
      .finally(() => {
        guestBootstrapStarted.current = false;
        setGuestBootstrapPending(false);
      });
  }, [needsGuestBootstrap, queryClient]);

  useEffect(() => {
    if (!window.narrativex?.auth) return;
    const unsubscribe = window.narrativex.auth.onCallback((response) => {
      void authApi.exchange(response)
        .then(async (user) => {
          setExchangeError(null);
          setLoginReason(null);
          queryClient.setQueryData(authQueryKeys.currentUser, user);
          await queryClient.invalidateQueries();
        })
        .catch((reason) => {
          setExchangeError(reason instanceof Error ? reason.message : "Mã đăng nhập không hợp lệ.");
        });
    });
    return unsubscribe;
  }, [queryClient]);

  // Guest browsing/editing must not activate the user-bound local executor/device identity.
  const localExecutionUserId = currentUser.data?.guest ? null : currentUser.data?.id ?? null;
  useEffect(() => {
    if (currentUser.isPending || guestBootstrapPending) return;
    if (!window.narrativex?.localExecution) {
      setBoundLocalUserId(localExecutionUserId);
      return;
    }

    let cancelled = false;
    setBoundLocalUserId(undefined);
    void window.narrativex.localExecution
      .setUser(localExecutionUserId)
      .then(() => {
        if (!cancelled) setBoundLocalUserId(localExecutionUserId);
      })
      .catch((error) => {
        // Local execution is optional for browsing/editing. The main process already
        // deactivates mismatched identities before a failed disk cleanup can surface.
        console.error("Failed to bind local execution to the current user", error);
        if (!cancelled) setBoundLocalUserId(localExecutionUserId);
      });
    return () => {
      cancelled = true;
    };
  }, [currentUser.isPending, guestBootstrapPending, localExecutionUserId]);

  if (currentUser.isPending || (needsGuestBootstrap && !bootstrapError)) {
    return (
      <main className="auth-screen">
        <div className="auth-loading">Đang mở NarrativeX…</div>
      </main>
    );
  }

  const syncingLocalIdentity =
    currentUser.data && boundLocalUserId !== localExecutionUserId;
  if (syncingLocalIdentity) {
    return (
      <main className="auth-screen">
        <div className="auth-loading">Đang chuẩn bị local workspace…</div>
      </main>
    );
  }

  return (
    <>
      {children}
      {loginReason && (
        <LoginModal
          reason={loginReason}
          error={exchangeError ?? undefined}
          onClose={() => {
            setExchangeError(null);
            setLoginReason(null);
          }}
          onLogin={() => {
            if (!window.narrativex?.auth) {
              return Promise.reject(new Error("Login chỉ khả dụng trong Electron Desktop."));
            }
            return window.narrativex.auth.login();
          }}
        />
      )}
      {bootstrapError && <div className="auth-bootstrap-error">{bootstrapError}</div>}
    </>
  );
}
