import type { ApiAuthUser } from "@/types/api";
import { isApiAuthUser } from "@/types/api";
import { apiRequest, apiUrl } from "@/shared/api/client";

export interface LoginInput {
  email: string;
  password: string;
}

export interface RegisterInput extends LoginInput {
  displayName: string;
}

export const authApi = {
  getCurrentUser: () => apiRequest<ApiAuthUser>("/api/auth/me", {}, isApiAuthUser),
  login: (input: LoginInput) =>
    apiRequest<ApiAuthUser>(
      "/api/auth/login",
      { method: "POST", json: input },
      isApiAuthUser,
    ),
  register: (input: RegisterInput) =>
    apiRequest<ApiAuthUser>(
      "/api/auth/register",
      { method: "POST", json: input },
      isApiAuthUser,
    ),
  logout: () => apiRequest<void>("/logout", { method: "POST", parseJson: false }),
  googleLoginUrl: () => apiUrl("/oauth2/authorization/google"),
};
