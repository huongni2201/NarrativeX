import type { BrowserWindow } from "electron";
import {
  DesktopPreferencesStore,
  type DesktopPreferenceResetScope,
} from "./desktop-preferences";
import {
  registerTrustedIpcHandler,
  type RendererTrustPolicy,
} from "../security/renderer-security";

function isResetScope(value: unknown): value is DesktopPreferenceResetScope {
  return value === "GEMINI" || value === "WINDOW" || value === "ALL";
}

function parseGeminiUpdate(value: unknown): {
  characterTabs?: number;
  storyboardTabs?: number;
} {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Invalid Gemini preference update.");
  }
  const input = value as Record<string, unknown>;
  const update: { characterTabs?: number; storyboardTabs?: number } = {};
  if (input.characterTabs !== undefined) {
    if (!Number.isInteger(input.characterTabs)) {
      throw new Error("characterTabs must be an integer.");
    }
    update.characterTabs = Number(input.characterTabs);
  }
  if (input.storyboardTabs !== undefined) {
    if (!Number.isInteger(input.storyboardTabs)) {
      throw new Error("storyboardTabs must be an integer.");
    }
    update.storyboardTabs = Number(input.storyboardTabs);
  }
  if (update.characterTabs === undefined && update.storyboardTabs === undefined) {
    throw new Error("At least one Gemini preference must be provided.");
  }
  return update;
}

export function registerDesktopPreferencesIpc(
  policy: RendererTrustPolicy,
  preferences: DesktopPreferencesStore,
  getMainWindow: () => BrowserWindow | null,
): void {
  registerTrustedIpcHandler("desktop:preferences:bind-user", policy, async (userId) => {
    if (typeof userId !== "string" || !userId.trim()) {
      throw new Error("userId must be a non-empty string.");
    }
    return preferences.bindUser(userId);
  });

  registerTrustedIpcHandler("desktop:preferences:get", policy, () => preferences.get());

  registerTrustedIpcHandler("desktop:preferences:update-gemini", policy, (input) =>
    preferences.updateGemini(parseGeminiUpdate(input)),
  );

  registerTrustedIpcHandler("desktop:preferences:reset", policy, async (scope) => {
    if (!isResetScope(scope)) throw new Error("Invalid Desktop preference reset scope.");
    const next = await preferences.reset(scope);
    if (scope === "WINDOW" || scope === "ALL") {
      const window = getMainWindow();
      if (window && !window.isDestroyed()) {
        window.maximize();
      }
    }
    return next;
  });
}
