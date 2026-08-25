export const AUTH_REQUIRED_EVENT = "narrativex:auth-required";

export interface AuthRequiredDetail {
  reason?: string;
  path?: string;
}

export function requestAuthentication(reason: string, path?: string): void {
  window.dispatchEvent(
    new CustomEvent<AuthRequiredDetail>(AUTH_REQUIRED_EVENT, {
      detail: { reason, path },
    }),
  );
}
