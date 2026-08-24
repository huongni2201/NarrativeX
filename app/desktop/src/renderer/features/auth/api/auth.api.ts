import { apiRequest } from "../../../api/client";

export interface DesktopAuthUser {
  id: string;
  displayName: string;
  email: string | null;
  avatarUrl: string | null;
}

function parseUser(value: unknown): DesktopAuthUser {
  if (!value || typeof value !== "object") {
    throw new Error("Current user response không đúng contract.");
  }
  const user = value as Partial<DesktopAuthUser>;
  if (
    typeof user.id !== "string" ||
    typeof user.displayName !== "string" ||
    (user.email !== null && typeof user.email !== "string") ||
    (user.avatarUrl !== null && typeof user.avatarUrl !== "string")
  ) {
    throw new Error("Current user response không đúng contract.");
  }
  return user as DesktopAuthUser;
}

export const authApi = {
  getCurrentUser: () => apiRequest<unknown>("/api/v1/auth/me").then(parseUser),
  exchange: (code: string) =>
    apiRequest<unknown>("/api/v1/auth/desktop/exchange", {
      method: "POST",
      body: JSON.stringify({ code }),
      headers: { "Content-Type": "application/json" },
    }).then(parseUser),
  logout: () => apiRequest<void>("/logout", { method: "POST" }),
};
