import { app, BrowserWindow, dialog, ipcMain, shell } from "electron";
import { join } from "node:path";
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

let mainWindow: BrowserWindow | null = null;
let localExecution: LocalExecutionService | null = null;
let projectStorage: ProjectStorage | null = null;
let desktopAuth: DesktopAuthService | null = null;
let ffmpegRuntime: FfmpegRuntimeStatus = { available: false, ffmpegPath: null, ffprobePath: null, version: null, reason: "Not initialized." };
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

function createWindow() {
  const iconPath = join(__dirname, "../../resources/narrativex-icon.png");
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
  window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));

  if (process.env.ELECTRON_RENDERER_URL) {
    void window.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    void window.loadFile(join(__dirname, "../renderer/index.html"));
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

void app.whenReady().then(async () => {
  app.setAppUserModelId("com.narrativex.desktop");
  ffmpegRuntime = await resolveFfmpegRuntime();
  const config = loadLocalExecutionConfig(ffmpegRuntime.available);
  app.setAsDefaultProtocolClient("narrativex");
  desktopAuth = new DesktopAuthService(config.backendBaseUrl);
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

  ipcMain.handle("desktop:app-version", () => app.getVersion());
  ipcMain.handle("desktop:auth:login", () => {
    if (!desktopAuth) throw new Error("Desktop auth is not initialized.");
    return desktopAuth.login();
  });
  ipcMain.handle("desktop:auth:consume-pending", () => {
    const code = pendingAuthCode;
    pendingAuthCode = null;
    return code;
  });
  ipcMain.handle("desktop:local-execution:status", () => requireLocalExecution().status());
  ipcMain.handle("desktop:local-execution:pair", async (_event, pairingCode: unknown) => {
    if (typeof pairingCode !== "string") throw new Error("Pairing code must be a string.");
    return requireLocalExecution().pair(pairingCode);
  });
  ipcMain.handle("desktop:local-execution:unpair", () => requireLocalExecution().unpair());
  ipcMain.handle("desktop:local-storage:ensure-project", async (_event, projectId: unknown) => {
    if (typeof projectId !== "string") throw new Error("projectId must be a string.");
    const manifest = await requireProjectStorage().ensureProject(projectId);
    return {
      projectId: manifest.projectId,
      projectDirectory: requireProjectStorage().projectDirectory(projectId),
      assetCount: Object.keys(manifest.assets).length,
      artifactCount: Object.keys(manifest.artifacts).length,
    };
  });
  ipcMain.handle("desktop:local-storage:import-asset", async (_event, input: unknown) => {
    if (!isAssetImportInput(input)) throw new Error("Invalid local asset import input.");
    const selected = await dialog.showOpenDialog({ properties: ["openFile"] });
    if (selected.canceled || !selected.filePaths[0]) return null;
    return requireProjectStorage().registerAsset(input.projectId, { assetId: input.assetId, kind: input.kind, sourcePath: selected.filePaths[0] });
  });
  ipcMain.handle("desktop:local-storage:reveal-artifact", async (_event, input: unknown) => {
    if (!isArtifactInput(input)) throw new Error("Invalid local artifact input.");
    const path = await requireProjectStorage().resolveArtifact(input.projectId, input.jobId);
    const error = await shell.openPath(path);
    if (error) throw new Error(error);
  });
  ipcMain.handle("desktop:render:status", () => ffmpegRuntime);
  ipcMain.handle("desktop:render:cancel", (_event, jobId: unknown) => {
    if (typeof jobId !== "string") throw new Error("jobId must be a string.");
    return requireLocalExecution().cancelProjectRender(jobId);
  });
  ipcMain.handle("desktop:system:select-files", async () => {
    const selected = await dialog.showOpenDialog({ properties: ["openFile", "multiSelections"] });
    return selected.canceled ? [] : selected.filePaths;
  });
  ipcMain.handle("desktop:system:select-folder", async () => {
    const selected = await dialog.showOpenDialog({ properties: ["openDirectory"] });
    return selected.canceled ? null : selected.filePaths[0] ?? null;
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

function isAssetImportInput(value: unknown): value is { projectId: string; assetId: string; kind: "IMAGE" | "AUDIO" | "VIDEO" | "OTHER" } {
  if (!value || typeof value !== "object") return false;
  const input = value as Record<string, unknown>;
  return typeof input.projectId === "string" && typeof input.assetId === "string" && ["IMAGE", "AUDIO", "VIDEO", "OTHER"].includes(String(input.kind));
}

function isArtifactInput(value: unknown): value is { projectId: string; jobId: string } {
  if (!value || typeof value !== "object") return false;
  const input = value as Record<string, unknown>;
  return typeof input.projectId === "string" && typeof input.jobId === "string";
}
