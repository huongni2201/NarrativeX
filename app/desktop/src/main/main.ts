import { app, BrowserWindow, ipcMain } from "electron";
import { join } from "node:path";
import { LocalExecutionBackendClient } from "./local-execution/backend-client";
import { loadLocalExecutionConfig } from "./local-execution/config";
import { DeviceIdentityStore } from "./local-execution/device-identity";
import { LocalExecutionService } from "./local-execution/service";
import { ProjectStorage } from "./local-storage/project-storage";

let mainWindow: BrowserWindow | null = null;
let localExecution: LocalExecutionService | null = null;
let projectStorage: ProjectStorage | null = null;

function createWindow() {
  const window = new BrowserWindow({
    width: 1600,
    height: 980,
    minWidth: 1180,
    minHeight: 720,
    backgroundColor: "#080b10",
    title: "NarrativeX",
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

void app.whenReady().then(() => {
  app.setAppUserModelId("com.narrativex.desktop");
  const config = loadLocalExecutionConfig();
  const identityStore = new DeviceIdentityStore();
  const backendClient = new LocalExecutionBackendClient(config, app.getVersion());
  projectStorage = new ProjectStorage(join(app.getPath("userData"), "projects"));
  localExecution = new LocalExecutionService(
    config,
    identityStore,
    backendClient,
    projectStorage,
  );

  ipcMain.handle("desktop:app-version", () => app.getVersion());
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
