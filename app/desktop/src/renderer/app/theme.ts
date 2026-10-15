import { useUiPreferencesStore, type ThemePreference } from "./ui-preferences.store";

export type ResolvedTheme = "light" | "dark";

const darkQuery = "(prefers-color-scheme: dark)";

export function resolveTheme(preference: ThemePreference, systemPrefersDark: boolean): ResolvedTheme {
  if (preference === "system") return systemPrefersDark ? "dark" : "light";
  return preference;
}

function applyTheme(preference: ThemePreference) {
  const prefersDark = window.matchMedia(darkQuery).matches;
  document.documentElement.dataset.theme = resolveTheme(preference, prefersDark);
}

/**
 * Applies the stored theme before React renders and keeps <html data-theme>
 * in sync with later changes, including OS changes while "system" is chosen.
 * The persisted store hydrates synchronously, so there is no flash of the
 * wrong theme after this runs.
 */
export function initTheme() {
  applyTheme(useUiPreferencesStore.getState().theme);
  useUiPreferencesStore.subscribe((state) => applyTheme(state.theme));
  window.matchMedia(darkQuery).addEventListener("change", () => {
    applyTheme(useUiPreferencesStore.getState().theme);
  });
}
