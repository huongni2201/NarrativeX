import { create } from "zustand";
import { persist } from "zustand/middleware";

export type ThemePreference = "system" | "light" | "dark";

interface UiPreferencesState {
  theme: ThemePreference;
  setTheme(theme: ThemePreference): void;
}

/**
 * Renderer-only view preferences. Server state stays in React Query and
 * business state stays in the backend; this store holds just what the user
 * chose about how the app looks.
 */
export const useUiPreferencesStore = create<UiPreferencesState>()(
  persist(
    (set) => ({
      theme: "dark",
      setTheme: (theme) => set({ theme }),
    }),
    { name: "narrativex.ui-preferences", version: 1 },
  ),
);
