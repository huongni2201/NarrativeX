import { create } from "zustand";
import type { ApiAuthUser } from "@/types/api";

export type AuthStatus = "bootstrapping" | "authenticated" | "unauthenticated" | "error";

interface AuthStore {
  status: AuthStatus;
  user: ApiAuthUser | null;
  error: string | null;
  setAuthenticated: (user: ApiAuthUser) => void;
  setUnauthenticated: () => void;
  setBootstrapError: (message: string) => void;
  clearSession: () => void;
}

export const useAuthStore = create<AuthStore>((set) => ({
  status: "bootstrapping",
  user: null,
  error: null,

  setAuthenticated: (user) => set({ status: "authenticated", user, error: null }),
  setUnauthenticated: () => set({ status: "unauthenticated", user: null, error: null }),
  setBootstrapError: (message) => set({ status: "error", user: null, error: message }),
  clearSession: () => set({ status: "unauthenticated", user: null, error: null }),
}));
