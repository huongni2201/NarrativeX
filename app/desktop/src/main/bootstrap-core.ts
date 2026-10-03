import { app, BrowserWindow, clipboard, Menu, screen, session } from "electron";
import { join, resolve } from "node:path";
import { DesktopBackendApiService, type DesktopApiResponse } from "./api/backend-api-service";
import { registerBackendSseIpc } from "./api/backend-sse-ipc";
import { LocalExecutionBackendClient } from "./local-execution/backend-client";
import { loadLocalExecutionConfig } from "./local-execution/config";
import { DeviceIdentityStore } from "./local-execution/device-identity";
import { LocalExecutionService } from "./local-execution/service";
import {
  installLocalAssetPreviewProtocol,
  registerLocalAssetPreviewScheme,
} from "./local-storage/local-asset-preview-protocol";
import { ProjectCatalog } from "./local-storage/project-catalog";
import { registerProjectCatalogIpc } from "./local-storage/project-catalog-ipc";
import { ProjectStorage } from "./local-storage/project-storage";
import { RemoteAssetMaterializer } from "./local-storage/remote-asset-materializer";
import { registerProjectStorageIpc } from "./local-storage/project-storage-ipc";
import { resolveFfmpegRuntime, type FfmpegRuntimeStatus } from "./rendering/ffmpeg-runtime";
import { ProjectRenderer } from "./rendering/project-renderer";
import { LocalRenderPreflightService } from "./rendering/local-render-preflight";
import { recoveryActionForStage, RenderJournalStore } from "./rendering/render-journal";
import { shouldDisableHardwareAcceleration } from "./runtime/gpu-policy";
import {
  hardenRendererWebContents,
  registerTrustedIpcHandler,
} from "./security/renderer-security";
import { createRendererTrustPolicy } from "./security/renderer-trust-policy";

registerLocalAssetPreviewScheme();

// Hardware acceleration is important for timeline/video preview performance. Keep it
// enabled by default and expose an explicit safe mode for machines with broken GPU
// drivers or Chromium initialization issues.
if (shouldDisableHardwareAcceleration(process.env, process.argv)) {
  app.disableHardwareAcceleration();
  app.commandLine.appendSwitch("disable-gpu");
  app.commandLine.appendSwitch("disable-gpu-compositing");
}

// Prevent Chromium on Windows from calling the native Windows spellchecker API,
// which can create corrupted unicode directories (e.g. Microsoft/Spelling) in cwd.
app.commandLine.appendSwitch("disable-features", "WinUseBrowserSpellChecker");

// Electron's default Chromium profile can remain locked by a stale dev
// process on Windows. Keep development state isolated in a writable profile;
// packaged Desktop builds continue using the normal persistent userData path.
if (!app.isPackaged) {
  app.setPath("userData", join(app.getPath("temp"), "narrativex-desktop-dev"));
}

let mainWindow: BrowserWindow | null = null;
let localExecution: LocalExecutionService | null = null;
let projectStorage: ProjectStorage | null = null;
let desktopApi: DesktopBackendApiService | null = null;
let ffmpegRuntime: FfmpegRuntimeStatus = {
  available: false,
  ffmpegPath: null,
  ffprobePath: null,
  version: null,
  reason: "Not initialized.",
};
let renderPreflight: LocalRenderPreflightService | null = null;
let renderJournals: RenderJournalStore | null = null;

const hasSingleInstanceLock = app.requestSingleInstanceLock();

if (!hasSingleInstanceLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    mainWindow?.show();
    mainWindow?.focus();
  });
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

async function showRendererFailure(window: BrowserWindow, rendererUrl: string, error: unknown): Promise<void> {
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

function createWindow() {
  const iconPath = join(__dirname, "../../resources/narrativex-icon.png");
  const trustPolicy = createRendererTrustPolicy(
    __dirname,
    app.isPackaged,
    process.env.ELECTRON_RENDERER_URL,
  );
  const display = screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
  const window = new BrowserWindow({
    width: Math.max(1180, display.workAreaSize.width),
    height: Math.max(720, display.workAreaSize.height),
    minWidth: 1180,
    minHeight: 720,
    backgroundColor: "#080b10",
    title: "NarrativeX",
    icon: iconPath,
    webPreferences: {
      preload: join(__dirname, "../preload/index.js"),
      contextIsolation: true,
      nodeIntegration: false,
      // Keep the renderer isolated from Node while allowing Chromium renderer
      // startup on environments where the Electron sandbox cannot initialize.
      sandbox: false,
      spellcheck: false,
    },
  });
  mainWindow = window;
  window.maximize();
  let rendererFailureShown = false;
  window.on("closed", () => {
    if (mainWindow === window) mainWindow = null;
  });
  hardenRendererWebContents(window.webContents, trustPolicy);
  window.webContents.on("did-fail-load", (_event, errorCode, errorDescription, validatedURL, isMainFrame) => {
    if (!isMainFrame || rendererFailureShown) return;
    rendererFailureShown = true;
    void showRendererFailure(window, validatedURL, `${errorDescription} (${errorCode})`);
  });
  window.webContents.on("render-process-gone", (_event, details) => {
    if (rendererFailureShown) return;
    rendererFailureShown = true;
    void showRendererFailure(window, trustPolicy.developmentRendererUrl ?? trustPolicy.productionEntryPath, `Renderer process exited: ${details.reason}`);
  });

  if (trustPolicy.developmentRendererUrl) {
    void window.loadURL(trustPolicy.developmentRendererUrl).catch((error) => {
      if (rendererFailureShown) return;
      rendererFailureShown = true;
      return showRendererFailure(window, trustPolicy.developmentRendererUrl!, error);
    });
  } else {
    void window.loadFile(trustPolicy.productionEntryPath).catch((error) => {
      if (rendererFailureShown) return;
      rendererFailureShown = true;
      return showRendererFailure(window, trustPolicy.productionEntryPath, error);
    });
  }

  if (!app.isPackaged) {
    const toggleDevTools = () => {
      if (window.webContents.isDevToolsOpened()) {
        window.webContents.closeDevTools();
      } else {
        window.webContents.openDevTools({ mode: "detach" });
      }
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
}

function requireLocalExecution(): LocalExecutionService {
  if (!localExecution) throw new Error("Local execution service is not initialized.");
  return localExecution;
}

function requireDesktopApi(): DesktopBackendApiService {
  if (!desktopApi) throw new Error("Desktop API service is not initialized.");
  return desktopApi;
}

function requireMainWindow(): BrowserWindow {
  if (!mainWindow || mainWindow.isDestroyed()) {
    throw new Error("NarrativeX main window is not available.");
  }
  return mainWindow;
}

void app.whenReady().then(async () => {
  app.setAppUserModelId("com.narrativex.desktop");
  Menu.setApplicationMenu(null);
  ffmpegRuntime = await resolveFfmpegRuntime();
  const config = loadLocalExecutionConfig(ffmpegRuntime.available);
  const trustPolicy = createRendererTrustPolicy(
    __dirname,
    app.isPackaged,
    process.env.ELECTRON_RENDERER_URL,
  );
  session.defaultSession.setPermissionRequestHandler(
    (_webContents, _permission, callback) => callback(false),
  );
  desktopApi = new DesktopBackendApiService(config.backendBaseUrl, session.defaultSession);
  const identityStore = new DeviceIdentityStore();
  const backendClient = new LocalExecutionBackendClient(config, app.getVersion());
  projectStorage = new ProjectStorage(join(app.getPath("userData"), "projects"));
  installLocalAssetPreviewProtocol(session.defaultSession.protocol, projectStorage);
  const projectCatalog = new ProjectCatalog(projectStorage);
  registerProjectCatalogIpc(trustPolicy, projectCatalog);
  renderPreflight = new LocalRenderPreflightService(ffmpegRuntime, projectStorage);
  renderJournals = new RenderJournalStore(projectStorage.rootDirectory());
  const remoteAssetMaterializer = new RemoteAssetMaterializer(projectStorage, desktopApi);
  registerProjectStorageIpc(trustPolicy, projectStorage, remoteAssetMaterializer, requireMainWindow, ffmpegRuntime);
  localExecution = new LocalExecutionService(
    config,
    identityStore,
    backendClient,
    projectStorage,
    new ProjectRenderer(ffmpegRuntime, projectStorage, renderJournals),
    renderJournals,
  );

  registerTrustedIpcHandler("desktop:app-version", trustPolicy, () => app.getVersion());
  registerTrustedIpcHandler("desktop:system:clipboard-write", trustPolicy, async (text) => {
    if (typeof text !== "string" || text.length > 200_000) {
      throw new Error("Invalid clipboard text.");
    }
    await clipboard.writeText(text);
  });
  registerTrustedIpcHandler("desktop:api:request", trustPolicy, (input) => {
    if (!isDesktopApiRequest(input)) throw new Error("Invalid desktop API request.");
    return requireDesktopApi().request(input);
  });
  registerBackendSseIpc(trustPolicy, requireDesktopApi);
  registerTrustedIpcHandler("desktop:local-execution:status", trustPolicy, () =>
    requireLocalExecution().status(),
  );
  registerTrustedIpcHandler(
    "desktop:local-execution:pair",
    trustPolicy,
    async (pairingCode) => {
      if (typeof pairingCode !== "string") throw new Error("Pairing code must be a string.");
      return requireLocalExecution().pair(pairingCode);
    },
  );
  registerTrustedIpcHandler("desktop:local-execution:unpair", trustPolicy, () =>
    requireLocalExecution().unpair(),
  );
  registerTrustedIpcHandler("desktop:render:status", trustPolicy, () => ffmpegRuntime);
  registerTrustedIpcHandler("desktop:render:preflight", trustPolicy, async (input) => {
    if (!isRenderPreflightInput(input)) throw new Error("Invalid render preflight input.");
    if (!renderPreflight) throw new Error("Render preflight is not initialized.");
    return renderPreflight.check(input, requireLocalExecution().renderPreflightContext());
  });
  registerTrustedIpcHandler("desktop:render:recovery-status", trustPolicy, async () => {
    if (!renderJournals) throw new Error("Render journal is not initialized.");
    const unfinished = await renderJournals.listUnfinished();
    return { unfinished: unfinished.map(({ projectId, jobId, stage, updatedAt, renderFingerprint }) => ({ projectId, jobId, stage, recoveryAction: recoveryActionForStage(stage), updatedAt, renderFingerprint })) };
  });
  registerTrustedIpcHandler("desktop:render:cancel", trustPolicy, (jobId) => {
    if (typeof jobId !== "string") throw new Error("jobId must be a string.");
    return requireLocalExecution().cancelProjectRender(jobId);
  });
  registerTrustedIpcHandler("desktop:window:minimize", trustPolicy, () => {
    requireMainWindow().minimize();
  });
  registerTrustedIpcHandler("desktop:window:toggle-maximize", trustPolicy, () => {
    const window = requireMainWindow();
    if (window.isMaximized()) {
      window.unmaximize();
      return false;
    }
    window.maximize();
    return true;
  });
  registerTrustedIpcHandler("desktop:window:close", trustPolicy, () => {
    requireMainWindow().close();
  });

  localExecution.on("status", (status) => {
    mainWindow?.webContents.send("desktop:local-execution:status-changed", status);
  });

  createWindow();
  void localExecution.start().catch((error) => {
    console.error("Failed to initialize local execution", error);
  });

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", () => {
  localExecution?.stop();
});

function isDesktopApiRequest(value: unknown): value is {
  path: string;
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  timeoutMs?: number;
} {
  if (!value || typeof value !== "object") return false;
  const input = value as Record<string, unknown>;
  if (typeof input.path !== "string") return false;
  if (input.method !== undefined && typeof input.method !== "string") return false;
  if (input.body !== undefined && typeof input.body !== "string") return false;
  if (input.timeoutMs !== undefined && typeof input.timeoutMs !== "number") return false;
  if (input.headers === undefined) return true;
  if (!input.headers || typeof input.headers !== "object" || Array.isArray(input.headers)) {
    return false;
  }
  return Object.entries(input.headers).every(
    ([key, headerValue]) => key.length > 0 && typeof headerValue === "string",
  );
}

function isRenderPreflightInput(value: unknown): value is { projectId: string; assetIds: string[]; estimatedOutputBytes: number; requiredTemporaryBytes: number } {
  if (!value || typeof value !== "object") return false;
  const input = value as Record<string, unknown>;
  return typeof input.projectId === "string" && Array.isArray(input.assetIds) && input.assetIds.every((item) => typeof item === "string") && typeof input.estimatedOutputBytes === "number" && typeof input.requiredTemporaryBytes === "number";
}
