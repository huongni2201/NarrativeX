import type { ApiAuthUser } from "@/types/api";
import { isApiAuthUser } from "@/types/api";
import { apiRequest, resetCsrfTokenCache } from "@/shared/api/client";

export interface LoginInput {
  email: string;
  password: string;
}

export interface RegisterInput extends LoginInput {
  displayName: string;
}

const AUTH_BASE_URL =
  process.env.NEXT_PUBLIC_AUTH_BASE_URL ??
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  "http://localhost:8080";

function authUrl(path: string) {
  return `${AUTH_BASE_URL.replace(/\/$/, "")}${path}`;
}

export const authApi = {
  getCurrentUser: () =>
    apiRequest<ApiAuthUser>(
      "/api/auth/me",
      { notifyUnauthorized: false },
      isApiAuthUser,
    ),
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
  googleLoginUrl: () => authUrl("/oauth2/authorization/google"),
};
