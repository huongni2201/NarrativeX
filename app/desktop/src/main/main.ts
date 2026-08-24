import { app, BrowserWindow, dialog, session, shell } from "electron";
import { join } from "node:path";
import { DesktopBackendApiService } from "./api/backend-api-service";
import { DesktopAuthService } from "./auth/auth-service";
import { AUTH_CALLBACK_CHANNEL } from "./auth/auth-events";
import { extractDesktopAuthCode, isNarrativeXProtocolUrl } from "./auth/protocol-handler";
import { LocalExecutionBackendClient } from "./local-execution/backend-client";
import { loadLocalExecutionConfig } from "./local-execution/config";
import { DeviceIdentityStore } from "./local-execution/device-identity";
import { LocalExecutionService } from "./local-execution/service";
import { ProjectStorage } from "./local-storage/project-storage";
import { resolveFfmpegRuntime, type FfmpegRuntimeStatus } from "./rendering/ffmpeg-runtime";
import { ProjectRenderer } from "./rendering/project-renderer";
import {
  hardenRendererWebContents,
  registerTrustedIpcHandler,
  type RendererTrustPolicy,
} from "./security/renderer-security";

let mainWindow: BrowserWindow | null = null;
let localExecution: LocalExecutionService | null = null;
let projectStorage: ProjectStorage | null = null;
let desktopAuth: DesktopAuthService | null = null;
let desktopApi: DesktopBackendApiService | null = null;
let ffmpegRuntime: FfmpegRuntimeStatus = {
  available: false,
  ffmpegPath: null,
  ffprobePath: null,
  version: null,
  reason: "Not initialized.",
};
let initialProtocolUrl: string | null = process.argv.find(isNarrativeXProtocolUrl) ?? null;
let pendingAuthCode: string | null = null;

const hasSingleInstanceLock = app.requestSingleInstanceLock();

function deliverProtocolUrl(value: string): void {
  const code = extractDesktopAuthCode(value);
  if (!code) return;
  if (!mainWindow || mainWindow.webContents.isLoading()) {
    pendingAuthCode = code;
    return;
  }
  mainWindow.webContents.send(AUTH_CALLBACK_CHANNEL, code);
}

if (!hasSingleInstanceLock) {
  app.quit();
} else {
  app.on("second-instance", (_event, commandLine) => {
    const url = commandLine.find(isNarrativeXProtocolUrl);
    if (url) deliverProtocolUrl(url);
    mainWindow?.show();
    mainWindow?.focus();
  });
  app.on("open-url", (event, url) => {
    event.preventDefault();
    deliverProtocolUrl(url);
  });
}

function rendererTrustPolicy(): RendererTrustPolicy {
  return {
    productionEntryPath: join(__dirname, "../renderer/index.html"),
    developmentRendererUrl: app.isPackaged
      ? undefined
      : process.env.ELECTRON_RENDERER_URL,
  };
}

function createWindow() {
  const iconPath = join(__dirname, "../../resources/narrativex-icon.png");
  const trustPolicy = rendererTrustPolicy();
  const window = new BrowserWindow({
    width: 1600,
    height: 980,
    minWidth: 1180,
    minHeight: 720,
    backgroundColor: "#080b10",
    title: "NarrativeX",
    icon: iconPath,
    webPreferences: {
      preload: join(__dirname, "../preload/index.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  mainWindow = window;
  window.on("closed", () => {
    if (mainWindow === window) mainWindow = null;
  });
  hardenRendererWebContents(window.webContents, trustPolicy);

  if (trustPolicy.developmentRendererUrl) {
    void window.loadURL(trustPolicy.developmentRendererUrl);
  } else {
    void window.loadFile(trustPolicy.productionEntryPath);
  }
}

function requireLocalExecution(): LocalExecutionService {
  if (!localExecution) throw new Error("Local execution service is not initialized.");
  return localExecution;
}

function requireProjectStorage(): ProjectStorage {
  if (!projectStorage) throw new Error("Local project storage is not initialized.");
  return projectStorage;
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
  ffmpegRuntime = await resolveFfmpegRuntime();
  const config = loadLocalExecutionConfig(ffmpegRuntime.available);
  const trustPolicy = rendererTrustPolicy();
  app.setAsDefaultProtocolClient("narrativex");
  session.defaultSession.setPermissionRequestHandler(
    (_webContents, _permission, callback) => callback(false),
  );
  desktopAuth = new DesktopAuthService(config.backendBaseUrl);
  desktopApi = new DesktopBackendApiService(config.backendBaseUrl, session.defaultSession);
  const identityStore = new DeviceIdentityStore();
  const backendClient = new LocalExecutionBackendClient(config, app.getVersion());
  projectStorage = new ProjectStorage(join(app.getPath("userData"), "projects"));
  localExecution = new LocalExecutionService(
    config,
    identityStore,
    backendClient,
    projectStorage,
    new ProjectRenderer(ffmpegRuntime, projectStorage),
  );

  registerTrustedIpcHandler("desktop:app-version", trustPolicy, () => app.getVersion());
  registerTrustedIpcHandler("desktop:api:request", trustPolicy, (input) => {
    if (!isDesktopApiRequest(input)) throw new Error("Invalid desktop API request.");
    return requireDesktopApi().request(input);
  });
  registerTrustedIpcHandler("desktop:auth:login", trustPolicy, () => {
    if (!desktopAuth) throw new Error("Desktop auth is not initialized.");
    return desktopAuth.login();
  });
  registerTrustedIpcHandler("desktop:auth:consume-pending", trustPolicy, () => {
    const code = pendingAuthCode;
    pendingAuthCode = null;
    return code;
  });
  registerTrustedIpcHandler("desktop:local-execution:status", trustPolicy, () =>
    requireLocalExecution().status(),
  );
  registerTrustedIpcHandler(
    "desktop:local-execution:set-user",
    trustPolicy,
    async (userId) => {
      if (userId !== null && typeof userId !== "string") {
        throw new Error("userId must be a string or null.");
      }
      return requireLocalExecution().setUser(userId);
    },
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
  registerTrustedIpcHandler(
    "desktop:local-storage:ensure-project",
    trustPolicy,
    async (projectId) => {
      if (typeof projectId !== "string") throw new Error("projectId must be a string.");
      const manifest = await requireProjectStorage().ensureProject(projectId);
      return {
        projectId: manifest.projectId,
        projectDirectory: requireProjectStorage().projectDirectory(projectId),
        assetCount: Object.keys(manifest.assets).length,
        artifactCount: Object.keys(manifest.artifacts).length,
      };
    },
  );
  registerTrustedIpcHandler(
    "desktop:local-storage:import-asset",
    trustPolicy,
    async (input) => {
      if (!isAssetImportInput(input)) throw new Error("Invalid local asset import input.");
      const selected = await dialog.showOpenDialog({ properties: ["openFile"] });
      if (selected.canceled || !selected.filePaths[0]) return null;
      return requireProjectStorage().registerAsset(input.projectId, {
        assetId: input.assetId,
        kind: input.kind,
        sourcePath: selected.filePaths[0],
      });
    },
  );
  registerTrustedIpcHandler(
    "desktop:local-storage:reveal-artifact",
    trustPolicy,
    async (input) => {
      if (!isArtifactInput(input)) throw new Error("Invalid local artifact input.");
      const path = await requireProjectStorage().resolveArtifact(input.projectId, input.jobId);
      const error = await shell.openPath(path);
      if (error) throw new Error(error);
    },
  );
  registerTrustedIpcHandler("desktop:render:status", trustPolicy, () => ffmpegRuntime);
  registerTrustedIpcHandler("desktop:render:cancel", trustPolicy, (jobId) => {
    if (typeof jobId !== "string") throw new Error("jobId must be a string.");
    return requireLocalExecution().cancelProjectRender(jobId);
  });
  registerTrustedIpcHandler("desktop:system:select-files", trustPolicy, async () => {
    const selected = await dialog.showOpenDialog({
      properties: ["openFile", "multiSelections"],
    });
    return selected.canceled ? [] : selected.filePaths;
  });
  registerTrustedIpcHandler("desktop:system:select-folder", trustPolicy, async () => {
    const selected = await dialog.showOpenDialog({ properties: ["openDirectory"] });
    return selected.canceled ? null : selected.filePaths[0] ?? null;
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
  if (initialProtocolUrl) {
    deliverProtocolUrl(initialProtocolUrl);
    initialProtocolUrl = null;
  }
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

function isAssetImportInput(value: unknown): value is {
  projectId: string;
  assetId: string;
  kind: "IMAGE" | "AUDIO" | "VIDEO" | "OTHER";
} {
  if (!value || typeof value !== "object") return false;
  const input = value as Record<string, unknown>;
  return (
    typeof input.projectId === "string" &&
    typeof input.assetId === "string" &&
    ["IMAGE", "AUDIO", "VIDEO", "OTHER"].includes(String(input.kind))
  );
}

function isArtifactInput(value: unknown): value is { projectId: string; jobId: string } {
  if (!value || typeof value !== "object") return false;
  const input = value as Record<string, unknown>;
  return typeof input.projectId === "string" && typeof input.jobId === "string";
}
