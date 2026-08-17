import type { ApiAuthUser } from "@/types/api";
import { isApiAuthUser } from "@/types/api";
import { apiRequest, apiUrl } from "@/shared/api/client";

export const authApi = {
  getCurrentUser: () => apiRequest<ApiAuthUser>("/api/auth/me", {}, isApiAuthUser),
  logout: () => apiRequest<void>("/logout", { method: "POST", parseJson: false }),
  googleLoginUrl: () => apiUrl("/oauth2/authorization/google"),
};
