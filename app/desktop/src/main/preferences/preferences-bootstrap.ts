import { app, BrowserWindow, screen } from "electron";
import { join } from "node:path";
import { DesktopPreferencesStore } from "./desktop-preferences";
import { registerDesktopPreferencesIpc } from "./desktop-preferences-ipc";
import { resolveRestoredWindowState } from "./window-state";
import type { RendererTrustPolicy } from "../security/renderer-security";

const preferences = new DesktopPreferencesStore(
  join(app.getPath("userData"), "desktop-preferences.json"),
  process.env,
);

function rendererTrustPolicy(): RendererTrustPolicy {
  return {
    productionEntryPath: join(__dirname, "../renderer/index.html"),
    developmentRendererUrl: app.isPackaged ? undefined : process.env.ELECTRON_RENDERER_URL,
  };
}

async function waitForMainWindow(): Promise<BrowserWindow | null> {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const window = BrowserWindow.getAllWindows()[0];
    if (window && !window.isDestroyed()) return window;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  return null;
}

async function restoreAndTrackWindow(window: BrowserWindow): Promise<void> {
  const lastActive = await preferences.getLastActive();
  if (lastActive?.window) {
    const fallbackDisplay = screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
    const restored = resolveRestoredWindowState(
      lastActive.window,
      screen.getAllDisplays(),
      fallbackDisplay,
    );
    if (window.isMaximized()) window.unmaximize();
    window.setBounds(restored.bounds);
    if (restored.maximized) window.maximize();
  }

  let timer: ReturnType<typeof setTimeout> | null = null;
  const save = () => {
    if (window.isDestroyed()) return;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      const bounds = window.getNormalBounds();
      void preferences
        .updateWindow({ ...bounds, maximized: window.isMaximized() })
        .catch(() => undefined);
    }, 150);
  };

  window.on("resize", save);
  window.on("move", save);
  window.on("maximize", save);
  window.on("unmaximize", save);
  window.on("close", () => {
    if (timer) clearTimeout(timer);
    const bounds = window.getNormalBounds();
    void preferences
      .updateWindow({ ...bounds, maximized: window.isMaximized() })
      .catch(() => undefined);
  });
}

void app.whenReady().then(async () => {
  registerDesktopPreferencesIpc(
    rendererTrustPolicy(),
    preferences,
    () => BrowserWindow.getAllWindows()[0] ?? null,
  );
  const window = await waitForMainWindow();
  if (window) await restoreAndTrackWindow(window);
});

export function desktopPreferencesStore(): DesktopPreferencesStore {
  return preferences;
}
