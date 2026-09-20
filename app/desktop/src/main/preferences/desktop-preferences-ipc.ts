import { screen, type BrowserWindow } from "electron";
import {
  DesktopPreferencesStore,
  type DesktopPreferenceResetScope,
  type SavedWindowState,
} from "./desktop-preferences";
import { resolveRestoredWindowState } from "./window-state";
import {
  registerTrustedIpcHandler,
  type RendererTrustPolicy,
} from "../security/renderer-security";

function isResetScope(value: unknown): value is DesktopPreferenceResetScope {
  return value === "WINDOW" || value === "ALL";
}

function applyWindowState(window: BrowserWindow, saved: SavedWindowState | null): void {
  const fallbackDisplay = screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
  const restored = resolveRestoredWindowState(saved, screen.getAllDisplays(), fallbackDisplay);
  if (window.isMaximized()) window.unmaximize();
  window.setBounds(restored.bounds);
  if (saved ? restored.maximized : true) window.maximize();
}

export function registerDesktopPreferencesIpc(
  policy: RendererTrustPolicy,
  preferences: DesktopPreferencesStore,
  getMainWindow: () => BrowserWindow | null,
): void {
  registerTrustedIpcHandler("desktop:preferences:get", policy, () => preferences.get());

  registerTrustedIpcHandler("desktop:preferences:reset", policy, async (scope) => {
    if (!isResetScope(scope)) throw new Error("Invalid Desktop preference reset scope.");
    const next = await preferences.reset(scope);
    if (scope === "WINDOW" || scope === "ALL") {
      const window = getMainWindow();
      if (window && !window.isDestroyed()) applyWindowState(window, next.window);
    }
    return next;
  });
}
