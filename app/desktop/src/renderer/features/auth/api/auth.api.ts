import {
  apiRequest,
  parseApiResponseBody,
  resetApiSessionState,
} from "../../../api/client";

interface DesktopAuthExchangeResponse {
  status: number;
  statusText: string;
  bodyText: string;
}

export interface DesktopAuthUser {
  id: string;
  displayName: string;
  email: string | null;
  avatarUrl: string | null;
  guest: boolean;
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
    (user.avatarUrl !== null && typeof user.avatarUrl !== "string") ||
    typeof user.guest !== "boolean"
  ) {
    throw new Error("Current user response không đúng contract.");
  }
  return user as DesktopAuthUser;
}

function completeSessionTransition(value: unknown): DesktopAuthUser {
  const user = parseUser(value);
  resetApiSessionState();
  return user;
}

export const authApi = {
  getCurrentUser: () => apiRequest<unknown>("/api/v1/auth/me").then(parseUser),
  ensureGuestSession: () =>
    apiRequest<unknown>("/api/v1/auth/desktop/guest", { method: "POST" }).then(
      completeSessionTransition,
    ),
  exchange: async (response: DesktopAuthExchangeResponse) => {
    if (response.status < 200 || response.status >= 300) {
      let message = response.statusText || "Desktop auth exchange failed";
      try {
        const body = JSON.parse(response.bodyText) as { message?: unknown };
        if (typeof body.message === "string" && body.message) message = body.message;
      } catch {
        // Preserve the transport status when the error body is not JSON.
      }
      throw new Error(message);
    }

    const envelope = parseApiResponseBody<unknown>(
      "/api/v1/auth/desktop/exchange",
      response.bodyText,
    );
    if (!Object.prototype.hasOwnProperty.call(envelope, "data")) {
      throw new Error("Desktop auth exchange response is invalid.");
    }
    return completeSessionTransition(envelope.data);
  },
  logout: async () => {
    const response = await window.narrativex.auth.logout();
    if (response.status < 200 || response.status >= 300) {
      throw new Error(response.statusText || "Logout failed");
    }
    resetApiSessionState();
  },
};
