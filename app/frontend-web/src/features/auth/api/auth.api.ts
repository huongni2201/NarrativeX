import type { ApiAuthUser } from "@/types/api";
import { isApiAuthUser } from "@/types/api";
import { apiRequest, resetCsrfTokenCache } from "@/shared/api/client";

// Start authentication on the browser-visible origin by default. Deployments
// with a separate Spring Security origin can opt in through this override.
const AUTH_BASE_URL = process.env.NEXT_PUBLIC_AUTH_BASE_URL?.trim();

function authUrl(path: string) {
  return AUTH_BASE_URL ? `${AUTH_BASE_URL.replace(/\/$/, "")}${path}` : path;
}

export const authApi = {
  getCurrentUser: () =>
    apiRequest<ApiAuthUser>(
      "/api/auth/me",
      { notifyUnauthorized: false },
      isApiAuthUser,
    ),
  logout: async () => {
    await apiRequest<void>("/logout", { method: "POST", parseJson: false });
    resetCsrfTokenCache();
  },
  googleLoginUrl: () => authUrl("/oauth2/authorization/google"),
};
