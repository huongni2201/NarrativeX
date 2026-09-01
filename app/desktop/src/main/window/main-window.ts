import { BrowserWindow, screen, type Rectangle } from "electron";
import type { DesktopPreferencesStore, SavedWindowState } from "../preferences/desktop-preferences";
import {
  DESKTOP_MIN_HEIGHT,
  DESKTOP_MIN_WIDTH,
  resolveRestoredWindowState,
} from "../preferences/window-state";
import {
  hardenRendererWebContents,
  type RendererTrustPolicy,
} from "../security/renderer-security";

export interface MainWindowOptions {
  trustPolicy: RendererTrustPolicy;
  preferences: DesktopPreferencesStore;
  iconPath: string;
  preloadPath: string;
  development: boolean;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>'"]/g, (character) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      "'": "&#39;",
      '"': "&quot;",
    };
    return entities[character] ?? character;
  });
}

function rendererFailureMarkup(rendererUrl: string, reason: string): string {
  return `<!doctype html>
<html lang="en">
  <head><meta charset="utf-8"><title>NarrativeX Desktop</title>
    <style>body{margin:0;background:#080b10;color:#edf3fb;font:14px system-ui,sans-serif;display:grid;place-items:center;min-height:100vh}.card{max-width:680px;margin:24px;padding:28px;border:1px solid rgba(163,184,207,.2);border-radius:10px;background:#0d131b;box-shadow:0 20px 50px rgba(0,0,0,.35)}h1{font-size:20px;margin:0 0 10px}p{color:#b7c4d4;line-height:1.6}code{display:block;margin-top:16px;padding:12px;border-radius:6px;background:#111a25;color:#e6b56b;white-space:pre-wrap;overflow-wrap:anywhere}.muted{font-size:12px;color:#8291a4}</style>
  </head>
  <body><main class="card"><h1>NarrativeX chưa tải được giao diện</h1>
    <p>Electron đã mở cửa sổ nhưng renderer không kết nối được. Hãy đóng các cửa sổ NarrativeX khác rồi khởi động lại ứng dụng.</p>
    <code>${escapeHtml(reason)}</code>
    <p class="muted">Renderer URL: ${escapeHtml(rendererUrl)}</p>
  </main></body>
</html>`;
}

async function showRendererFailure(
  window: BrowserWindow,
  rendererUrl: string,
  error: unknown,
): Promise<void> {
  if (window.isDestroyed()) return;
  const reason = error instanceof Error ? error.message : String(error);
  console.error("NarrativeX renderer failed to load", { rendererUrl, reason });
  try {
    await window.loadURL(
      `data:text/html;charset=utf-8,${encodeURIComponent(rendererFailureMarkup(rendererUrl, reason))}`,
    );
  } catch (fallbackError) {
    console.error("NarrativeX renderer failure page could not be displayed", fallbackError);
  }
}

function toSavedWindowState(bounds: Rectangle, maximized: boolean): SavedWindowState {
  return {
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
    maximized,
  };
}

export async function createMainWindow(options: MainWindowOptions): Promise<BrowserWindow> {
  const fallbackDisplay = screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
  const lastActive = await options.preferences.getLastActive();
  const restored = resolveRestoredWindowState(
    lastActive?.window,
    screen.getAllDisplays(),
    fallbackDisplay,
  );

  const window = new BrowserWindow({
    ...restored.bounds,
    minWidth: DESKTOP_MIN_WIDTH,
    minHeight: DESKTOP_MIN_HEIGHT,
    backgroundColor: "#080b10",
    title: "NarrativeX",
    icon: options.iconPath,
    webPreferences: {
      preload: options.preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      spellcheck: false,
    },
  });
  if (restored.maximized) window.maximize();

  let rendererFailureShown = false;
  let saveTimer: ReturnType<typeof setTimeout> | null = null;
  const persistWindowState = () => {
    if (window.isDestroyed()) return;
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      saveTimer = null;
      const state = toSavedWindowState(window.getNormalBounds(), window.isMaximized());
      void options.preferences.updateWindow(state).catch(() => undefined);
    }, 150);
  };

  window.on("resize", persistWindowState);
  window.on("move", persistWindowState);
  window.on("maximize", persistWindowState);
  window.on("unmaximize", persistWindowState);
  window.on("close", () => {
    if (saveTimer) clearTimeout(saveTimer);
    const state = toSavedWindowState(window.getNormalBounds(), window.isMaximized());
    void options.preferences.updateWindow(state).catch(() => undefined);
  });

  hardenRendererWebContents(window.webContents, options.trustPolicy);
  window.webContents.on(
    "did-fail-load",
    (_event, errorCode, errorDescription, validatedURL, isMainFrame) => {
      if (!isMainFrame || rendererFailureShown) return;
      rendererFailureShown = true;
      void showRendererFailure(window, validatedURL, `${errorDescription} (${errorCode})`);
    },
  );
  window.webContents.on("render-process-gone", (_event, details) => {
    if (rendererFailureShown) return;
    rendererFailureShown = true;
    void showRendererFailure(
      window,
      options.trustPolicy.developmentRendererUrl ?? options.trustPolicy.productionEntryPath,
      `Renderer process exited: ${details.reason}`,
    );
  });

  if (options.trustPolicy.developmentRendererUrl) {
    void window.loadURL(options.trustPolicy.developmentRendererUrl).catch((error) => {
      if (rendererFailureShown) return;
      rendererFailureShown = true;
      return showRendererFailure(window, options.trustPolicy.developmentRendererUrl!, error);
    });
  } else {
    void window.loadFile(options.trustPolicy.productionEntryPath).catch((error) => {
      if (rendererFailureShown) return;
      rendererFailureShown = true;
      return showRendererFailure(window, options.trustPolicy.productionEntryPath, error);
    });
  }

  if (options.development) {
    const toggleDevTools = () => {
      if (window.webContents.isDevToolsOpened()) window.webContents.closeDevTools();
      else window.webContents.openDevTools({ mode: "detach" });
    };
    window.webContents.on("before-input-event", (event, input) => {
      const isDevToolsShortcut =
        input.type === "keyDown" &&
        (input.key === "F12" ||
          (input.control && input.shift && input.key.toLowerCase() === "i"));
      if (!isDevToolsShortcut) return;
      event.preventDefault();
      toggleDevTools();
    });
  }

  return window;
}
