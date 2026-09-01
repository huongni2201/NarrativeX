import { useEffect, useLayoutEffect, useRef, useState, type PropsWithChildren } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { DesktopApiError } from "../../api/client";
import {
  AUTH_REQUIRED_EVENT,
  requestAuthentication,
  type AuthRequiredDetail,
} from "../../api/auth-required-event";
import { authApi } from "./api/auth.api";
import { configureAuthenticatedActionGate } from "./authenticated-action";
import { LoginModal } from "./components/LoginModal";
import { authQueryKeys, useCurrentUserQuery } from "./queries/auth.queries";

export function AuthGuard({ children }: PropsWithChildren) {
  const queryClient = useQueryClient();
  const currentUser = useCurrentUserQuery();
  const guestBootstrapStarted = useRef(false);
  const [exchangeError, setExchangeError] = useState<string | null>(null);
  const [bootstrapError, setBootstrapError] = useState<string | null>(null);
  const [guestBootstrapPending, setGuestBootstrapPending] = useState(false);
  const [loginReason, setLoginReason] = useState<string | null>(null);
  const [boundLocalUserId, setBoundLocalUserId] = useState<string | null | undefined>(undefined);
  const signedIn = Boolean(currentUser.data && !currentUser.data.guest);

  useEffect(() => {
    const handleAuthRequired = (event: Event) => {
      const detail = (event as CustomEvent<AuthRequiredDetail>).detail;
      setExchangeError(null);
      setLoginReason(detail?.reason ?? "Đăng nhập để sử dụng tính năng này.");
    };
    window.addEventListener(AUTH_REQUIRED_EVENT, handleAuthRequired);
    return () => window.removeEventListener(AUTH_REQUIRED_EVENT, handleAuthRequired);
  }, []);

  useLayoutEffect(
    () =>
      configureAuthenticatedActionGate({
        signedIn,
        onAuthenticationRequired: (reason) => requestAuthentication(reason),
      }),
    [signedIn],
  );

  const needsGuestBootstrap =
    currentUser.error instanceof DesktopApiError && currentUser.error.status === 401;

  const replaceAuthenticatedUser = (user: NonNullable<typeof currentUser.data>) => {
    // Every non-auth query can contain account-scoped data (projects, assets,
    // timelines, etc.). Remove it before switching identities so a newly
    // authenticated user can never render cached data from the previous one.
    queryClient.removeQueries({
      predicate: (query) => query.queryKey[0] !== "auth",
    });
    queryClient.setQueryData(authQueryKeys.currentUser, user);
  };

  useEffect(() => {
    if (!needsGuestBootstrap || guestBootstrapStarted.current) return;
    guestBootstrapStarted.current = true;
    setGuestBootstrapPending(true);
    setBootstrapError(null);
    void authApi.ensureGuestSession()
      .then((user) => {
        replaceAuthenticatedUser(user);
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
        .then((user) => {
          setExchangeError(null);
          setLoginReason(null);
          replaceAuthenticatedUser(user);
        })
        .catch((reason) => {
          setExchangeError(reason instanceof Error ? reason.message : "Mã đăng nhập không hợp lệ.");
        });
    });
    return unsubscribe;
  }, [queryClient]);

  // Guest browsing must not activate the user-bound local executor/device identity.
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
        // Local execution is optional for browsing. The main process already
        // deactivates mismatched identities before a failed disk cleanup can surface.
        console.error("Failed to bind local execution to the current user", error);
        if (!cancelled) setBoundLocalUserId(localExecutionUserId);
      });
    return () => {
      cancelled = true;
    };
  }, [currentUser.isPending, guestBootstrapPending, localExecutionUserId]);

  useEffect(() => {
    if (!currentUser.data || !window.narrativex?.preferences) return;
    void window.narrativex.preferences.bindUser(currentUser.data.id).catch((error) => {
      console.error("Failed to bind Desktop preferences to the current user", error);
    });
  }, [currentUser.data?.id]);

  if (currentUser.isPending || (needsGuestBootstrap && !bootstrapError)) {
    return (
      <main className="grid min-h-dvh place-items-center bg-[var(--bg)] p-6 text-sm text-[var(--text-3)]">
        <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-6 py-5">Đang mở NarrativeX…</div>
      </main>
    );
  }

  const syncingLocalIdentity =
    currentUser.data && boundLocalUserId !== localExecutionUserId;
  if (syncingLocalIdentity) {
    return (
      <main className="grid min-h-dvh place-items-center bg-[var(--bg)] p-6 text-sm text-[var(--text-3)]">
        <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-6 py-5">Đang chuẩn bị local workspace…</div>
      </main>
    );
  }

  return (
    <>
      <div className="h-dvh min-h-0 overflow-hidden">{children}</div>
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
      {bootstrapError && <div className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-md border border-[var(--danger)]/40 bg-[var(--surface)] px-4 py-3 text-xs text-[var(--danger)] shadow-lg">{bootstrapError}</div>}
    </>
  );
}
