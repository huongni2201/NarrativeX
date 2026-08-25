import { app, BrowserWindow, dialog, session, shell } from "electron";
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { join } from "node:path";
import { basename, extname } from "node:path";
import { DesktopBackendApiService, type DesktopApiResponse } from "./api/backend-api-service";
import { DesktopAuthService } from "./auth/auth-service";
import { AUTH_CALLBACK_CHANNEL } from "./auth/auth-events";
import { extractDesktopAuthCode, isNarrativeXProtocolUrl } from "./auth/protocol-handler";
import { LocalExecutionBackendClient } from "./local-execution/backend-client";
import { loadLocalExecutionConfig } from "./local-execution/config";
import { DeviceIdentityStore } from "./local-execution/device-identity";
import { LocalExecutionService } from "./local-execution/service";
import { ProjectStorage } from "./local-storage/project-storage";
import { RemoteAssetMaterializer } from "./local-storage/remote-asset-materializer";
import {
  REPLACE_PROJECT_DIALOG_RESPONSE,
  shouldProceedWithRestore,
} from "./local-storage/restore-confirmation";
import { resolveFfmpegRuntime, type FfmpegRuntimeStatus } from "./rendering/ffmpeg-runtime";
import { ProjectRenderer } from "./rendering/project-renderer";
import { LocalRenderPreflightService } from "./rendering/local-render-preflight";
import { recoveryActionForStage, RenderJournalStore } from "./rendering/render-journal";
import {
  hardenRendererWebContents,
  registerTrustedIpcHandler,
  registerTrustedIpcHandlerWithEvent,
  type RendererTrustPolicy,
} from "./security/renderer-security";
import { SelectionTokenStore } from "./security/selection-token-store";

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
let renderPreflight: LocalRenderPreflightService | null = null;
let renderJournals: RenderJournalStore | null = null;
let remoteAssetMaterializer: RemoteAssetMaterializer | null = null;
let initialProtocolUrl: string | null = process.argv.find(isNarrativeXProtocolUrl) ?? null;
let pendingAuthCode: string | null = null;
const pendingAssetSelections = new SelectionTokenStore<{ sourcePath: string; kind: "IMAGE" | "AUDIO" | "VIDEO" | "OTHER" }>();

const hasSingleInstanceLock = app.requestSingleInstanceLock();

function authFailureResponse(): DesktopApiResponse {
  return {
    status: 401,
    statusText: "Desktop authentication failed",
    bodyText: JSON.stringify({ success: false, message: "Desktop authentication exchange failed." }),
  };
}

async function exchangeDesktopAuthCode(code: string): Promise<DesktopApiResponse> {
  if (!desktopAuth) return authFailureResponse();
  try {
    return await desktopAuth.exchange(code);
  } catch {
    return authFailureResponse();
  }
}

function deliverProtocolCode(code: string): void {
  if (!mainWindow || mainWindow.webContents.isLoading() || !desktopAuth) {
    pendingAuthCode = code;
    return;
  }
  void exchangeDesktopAuthCode(code).then((result) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send(AUTH_CALLBACK_CHANNEL, result);
    }
  });
}

function deliverProtocolUrl(value: string): void {
  const code = extractDesktopAuthCode(value);
  if (!code) return;
  deliverProtocolCode(code);
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
  desktopApi = new DesktopBackendApiService(config.backendBaseUrl, session.defaultSession);
  desktopAuth = new DesktopAuthService(
    config.backendBaseUrl,
    desktopApi,
    (url) => shell.openExternal(url),
  );
  const identityStore = new DeviceIdentityStore();
  const backendClient = new LocalExecutionBackendClient(config, app.getVersion());
  projectStorage = new ProjectStorage(join(app.getPath("userData"), "projects"));
  renderPreflight = new LocalRenderPreflightService(ffmpegRuntime, projectStorage);
  renderJournals = new RenderJournalStore(projectStorage.rootDirectory());
  remoteAssetMaterializer = new RemoteAssetMaterializer(projectStorage, desktopApi);
  localExecution = new LocalExecutionService(
    config,
    identityStore,
    backendClient,
    projectStorage,
    new ProjectRenderer(ffmpegRuntime, projectStorage, renderJournals),
    renderJournals,
  );

  registerTrustedIpcHandler("desktop:app-version", trustPolicy, () => app.getVersion());
  registerTrustedIpcHandler("desktop:api:request", trustPolicy, (input) => {
    if (!isDesktopApiRequest(input)) throw new Error("Invalid desktop API request.");
    return requireDesktopApi().request(input);
  });
  registerTrustedIpcHandler("desktop:auth:login", trustPolicy, () => {
    if (!desktopAuth) throw new Error("Desktop auth is not initialized.");
    pendingAuthCode = null;
    return desktopAuth.login();
  });
  registerTrustedIpcHandler("desktop:auth:logout", trustPolicy, () => {
    if (!desktopAuth) throw new Error("Desktop auth is not initialized.");
    return desktopAuth.logout();
  });
  registerTrustedIpcHandler("desktop:auth:consume-pending", trustPolicy, () => {
    const code = pendingAuthCode;
    pendingAuthCode = null;
    return code ? exchangeDesktopAuthCode(code) : null;
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
  registerTrustedIpcHandler("desktop:local-storage:summary", trustPolicy, async (projectId) => {
    if (typeof projectId !== "string") throw new Error("projectId must be a string.");
    return requireProjectStorage().storageSummary(projectId);
  });
  registerTrustedIpcHandler("desktop:local-storage:delete-managed-snapshot", trustPolicy, async (input) => {
    if (!input || typeof input !== "object") throw new Error("Invalid managed snapshot delete request.");
    const request = input as { projectId?: unknown; snapshotId?: unknown };
    if (typeof request.projectId !== "string" || typeof request.snapshotId !== "string") {
      throw new Error("projectId and snapshotId must be strings.");
    }
    return requireProjectStorage().deleteManagedSnapshot(request.projectId, request.snapshotId);
  });
  registerTrustedIpcHandler("desktop:local-storage:verify-project", trustPolicy, async (projectId) => {
    if (typeof projectId !== "string") throw new Error("projectId must be a string.");
    return requireProjectStorage().verifyAssets(projectId);
  });
  registerTrustedIpcHandler("desktop:local-storage:cleanup-completed-work", trustPolicy, async (projectId) => {
    if (typeof projectId !== "string") throw new Error("projectId must be a string.");
    return requireProjectStorage().cleanupCompletedWork(projectId);
  });
  registerTrustedIpcHandler("desktop:local-storage:create-backup", trustPolicy, async (projectId) => {
    if (typeof projectId !== "string") throw new Error("projectId must be a string.");
    const selected = await dialog.showOpenDialog(requireMainWindow(), { properties: ["openDirectory", "createDirectory"] });
    const destinationDirectory = selected.filePaths[0];
    if (selected.canceled || !destinationDirectory) return null;
    const result = await requireProjectStorage().createBackup(projectId, destinationDirectory);
    return { projectId: result.projectId, snapshotId: result.snapshotId, manifestSchemaVersion: result.manifestSchemaVersion, createdAt: result.createdAt, sizeBytes: result.sizeBytes };
  });
  registerTrustedIpcHandler("desktop:local-storage:restore-backup", trustPolicy, async () => {
    const selected = await dialog.showOpenDialog(requireMainWindow(), { properties: ["openDirectory"] });
    const backupDirectory = selected.filePaths[0];
    if (selected.canceled || !backupDirectory) return null;
    const storage = requireProjectStorage();
    const inspection = await storage.inspectBackup(backupDirectory);
    let dialogResponse: number | undefined;
    if (inspection.targetExists) {
      const confirmation = await dialog.showMessageBox(requireMainWindow(), {
        type: "warning",
        title: "Replace local project?",
        message: `A local project with ID ${inspection.projectId} already exists.`,
        detail:
          "Restoring this backup will replace the current local project. NarrativeX will keep a pre-restore snapshot so the previous project can be recovered manually if needed.",
        buttons: ["Cancel", "Replace Project"],
        defaultId: 0,
        cancelId: 0,
        noLink: true,
      });
      dialogResponse = confirmation.response;
    }
    if (!shouldProceedWithRestore(inspection.targetExists, dialogResponse)) return null;
    const result = await storage.restoreBackup({
      backupDirectory,
      replaceExisting: inspection.targetExists && dialogResponse === REPLACE_PROJECT_DIALOG_RESPONSE,
    });
    return { projectId: result.projectId, replacedExisting: result.replacedExisting, previousProjectSnapshotId: result.previousProjectSnapshotId };
  });
  registerTrustedIpcHandler("desktop:local-storage:archive-project", trustPolicy, async (projectId) => {
    if (typeof projectId !== "string") throw new Error("projectId must be a string.");
    const selected = await dialog.showOpenDialog(requireMainWindow(), { properties: ["openDirectory", "createDirectory"] });
    const destinationDirectory = selected.filePaths[0];
    if (selected.canceled || !destinationDirectory) return null;
    const result = await requireProjectStorage().archiveProject(projectId, destinationDirectory);
    return { projectId: result.projectId, sizeBytes: result.sizeBytes };
  });
  registerTrustedIpcHandler("desktop:local-storage:materialize-remote-asset", trustPolicy, async (input) => {
    if (!isRemoteMaterializationInput(input) || !remoteAssetMaterializer) throw new Error("Invalid remote asset materialization input.");
    return remoteAssetMaterializer.materialize(input);
  });
  registerTrustedIpcHandlerWithEvent("desktop:local-storage:repair-selected-asset", trustPolicy, async (event, input) => {
    if (!isSelectedAssetCommitInput(input)) throw new Error("Invalid selected asset repair input.");
    const selection = pendingAssetSelections.consume(input.selectionToken, event.sender.id, "asset-import");
    if (selection.kind !== input.kind) throw new Error("Local asset kind changed before repair.");
    return requireProjectStorage().registerAsset(input.projectId, { assetId: input.assetId, kind: input.kind, sourcePath: selection.sourcePath });
  });
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
        assetCount: Object.keys(manifest.assets).length,
        artifactCount: Object.keys(manifest.artifacts).length,
      };
    },
  );
  registerTrustedIpcHandlerWithEvent("desktop:local-storage:select-asset", trustPolicy, async (event) => {
    const selected = await dialog.showOpenDialog(requireMainWindow(), { properties: ["openFile"] });
    const sourcePath = selected.filePaths[0];
    if (selected.canceled || !sourcePath) return null;
    const file = await stat(sourcePath);
    if (!file.isFile() || file.size <= 0) throw new Error("Selected asset must be a non-empty file.");
    const checksumSha256 = await checksumFile(sourcePath);
    const kind = kindForPath(sourcePath);
    const selectionToken = pendingAssetSelections.create(event.sender.id, "asset-import", { sourcePath, kind });
    return { selectionToken, originalFilename: basename(sourcePath), contentType: contentTypeForPath(sourcePath), sizeBytes: file.size, checksumSha256, kind };
  });
  registerTrustedIpcHandlerWithEvent("desktop:local-storage:commit-selected-asset", trustPolicy, async (event, input) => {
    if (!isSelectedAssetCommitInput(input)) throw new Error("Invalid selected asset commit input.");
    const selection = pendingAssetSelections.consume(input.selectionToken, event.sender.id, "asset-import");
    if (selection.kind !== input.kind) throw new Error("Local asset kind changed before commit.");
    return requireProjectStorage().registerAsset(input.projectId, { assetId: input.assetId, kind: input.kind, sourcePath: selection.sourcePath });
  });
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
  pendingAuthCode = null;
  desktopAuth?.clearPendingLogin();
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

function isSelectedAssetCommitInput(value: unknown): value is {
  projectId: string;
  assetId: string;
  kind: "IMAGE" | "AUDIO" | "VIDEO" | "OTHER";
  selectionToken: string;
} {
  if (!value || typeof value !== "object") return false;
  const input = value as Record<string, unknown>;
  return (
    typeof input.projectId === "string" &&
    typeof input.assetId === "string" &&
    typeof input.selectionToken === "string" &&
    ["IMAGE", "AUDIO", "VIDEO", "OTHER"].includes(String(input.kind))
  );
}

function kindForPath(sourcePath: string): "IMAGE" | "AUDIO" | "VIDEO" | "OTHER" {
  const extension = extname(sourcePath).toLowerCase();
  if ([".png", ".jpg", ".jpeg", ".webp", ".gif", ".bmp"].includes(extension)) return "IMAGE";
  if ([".mp3", ".wav", ".m4a", ".aac", ".flac", ".ogg"].includes(extension)) return "AUDIO";
  if ([".mp4", ".mov", ".mkv", ".webm", ".avi"].includes(extension)) return "VIDEO";
  return "OTHER";
}

function contentTypeForPath(sourcePath: string): string {
  const extension = extname(sourcePath).toLowerCase();
  const types: Record<string, string> = { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".mp3": "audio/mpeg", ".wav": "audio/wav", ".m4a": "audio/mp4", ".mp4": "video/mp4", ".mov": "video/quicktime", ".webm": "video/webm" };
  return types[extension] ?? "application/octet-stream";
}

async function checksumFile(sourcePath: string): Promise<string> {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(sourcePath)) hash.update(chunk);
  return hash.digest("hex");
}

function isArtifactInput(value: unknown): value is { projectId: string; jobId: string } {
  if (!value || typeof value !== "object") return false;
  const input = value as Record<string, unknown>;
  return typeof input.projectId === "string" && typeof input.jobId === "string";
}

function isRenderPreflightInput(value: unknown): value is { projectId: string; assetIds: string[]; estimatedOutputBytes: number; requiredTemporaryBytes: number } {
  if (!value || typeof value !== "object") return false;
  const input = value as Record<string, unknown>;
  return typeof input.projectId === "string" && Array.isArray(input.assetIds) && input.assetIds.every((item) => typeof item === "string") && typeof input.estimatedOutputBytes === "number" && typeof input.requiredTemporaryBytes === "number";
}

function isRemoteMaterializationInput(value: unknown): value is { projectId: string; assetId: string } {
  if (!value || typeof value !== "object") return false;
  const input = value as Record<string, unknown>;
  return typeof input.projectId === "string" && typeof input.assetId === "string";
}
