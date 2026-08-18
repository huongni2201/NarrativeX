import type { ApiAuthUser } from "@/types/api";
import { isApiAuthUser } from "@/types/api";
import { apiRequest, apiUrl, resetCsrfTokenCache } from "@/shared/api/client";

export interface LoginInput {
  email: string;
  password: string;
}

export interface RegisterInput extends LoginInput {
  displayName: string;
}

export const authApi = {
  getCurrentUser: () => apiRequest<ApiAuthUser>("/api/auth/me", {}, isApiAuthUser),
  login: async (input: LoginInput) => {
    const user = await apiRequest<ApiAuthUser>(
      "/api/auth/login",
      { method: "POST", json: input, notifyUnauthorized: false },
      isApiAuthUser,
    );
    resetCsrfTokenCache();
    return user;
  },
  register: async (input: RegisterInput) => {
    const user = await apiRequest<ApiAuthUser>(
      "/api/auth/register",
      { method: "POST", json: input, notifyUnauthorized: false },
      isApiAuthUser,
    );
    resetCsrfTokenCache();
    return user;
  },
  logout: async () => {
    await apiRequest<void>("/logout", { method: "POST", parseJson: false });
    resetCsrfTokenCache();
  },
  googleLoginUrl: () => apiUrl("/oauth2/authorization/google"),
};
