import { dialog, shell, type BrowserWindow } from "electron";
import { stat } from "node:fs/promises";
import { basename, extname } from "node:path";
import { registerTrustedIpcHandler, registerTrustedIpcHandlerWithEvent, type RendererTrustPolicy } from "../security/renderer-security";
import { SelectionTokenStore } from "../security/selection-token-store";
import { probeMediaDuration } from "../rendering/ffprobe";
import type { FfmpegRuntimeStatus } from "../rendering/ffmpeg-runtime";
import type { ProjectStorage } from "./project-storage";
import type { RemoteAssetMaterializer } from "./remote-asset-materializer";
import { sha256File } from "./file-integrity.ts";
import { REPLACE_PROJECT_DIALOG_RESPONSE, shouldProceedWithRestore } from "./restore-confirmation";

const pendingAssetSelections = new SelectionTokenStore<{ sourcePath: string; kind: "IMAGE" | "AUDIO" | "VIDEO" | "OTHER" }>();

export function registerProjectStorageIpc(trustPolicy: RendererTrustPolicy, storage: ProjectStorage, materializer: RemoteAssetMaterializer, requireMainWindow: () => BrowserWindow, ffmpegRuntime: FfmpegRuntimeStatus): void {
  registerTrustedIpcHandler("desktop:local-storage:summary", trustPolicy, async (projectId) => {
    if (typeof projectId !== "string") throw new Error("projectId must be a string.");
    return storage.storageSummary(projectId);
  });
  registerTrustedIpcHandler("desktop:local-storage:delete-managed-snapshot", trustPolicy, async (input) => {
    if (!input || typeof input !== "object") throw new Error("Invalid managed snapshot delete request.");
    const request = input as { projectId?: unknown; snapshotId?: unknown };
    if (typeof request.projectId !== "string" || typeof request.snapshotId !== "string") {
      throw new Error("projectId and snapshotId must be strings.");
    }
    return storage.deleteManagedSnapshot(request.projectId, request.snapshotId);
  });
  registerTrustedIpcHandler("desktop:local-storage:verify-project", trustPolicy, async (projectId) => {
    if (typeof projectId !== "string") throw new Error("projectId must be a string.");
    return storage.verifyAssets(projectId);
  });
  registerTrustedIpcHandler("desktop:local-storage:cleanup-completed-work", trustPolicy, async (projectId) => {
    if (typeof projectId !== "string") throw new Error("projectId must be a string.");
    return storage.cleanupCompletedWork(projectId);
  });
  registerTrustedIpcHandler("desktop:local-storage:create-backup", trustPolicy, async (projectId) => {
    if (typeof projectId !== "string") throw new Error("projectId must be a string.");
    const selected = await dialog.showOpenDialog(requireMainWindow(), { properties: ["openDirectory", "createDirectory"] });
    const destinationDirectory = selected.filePaths[0];
    if (selected.canceled || !destinationDirectory) return null;
    const result = await storage.createBackup(projectId, destinationDirectory);
    return { projectId: result.projectId, snapshotId: result.snapshotId, manifestSchemaVersion: result.manifestSchemaVersion, createdAt: result.createdAt, sizeBytes: result.sizeBytes };
  });
  registerTrustedIpcHandler("desktop:local-storage:restore-backup", trustPolicy, async () => {
    const selected = await dialog.showOpenDialog(requireMainWindow(), { properties: ["openDirectory"] });
    const backupDirectory = selected.filePaths[0];
    if (selected.canceled || !backupDirectory) return null;
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
    const result = await storage.archiveProject(projectId, destinationDirectory);
    return { projectId: result.projectId, sizeBytes: result.sizeBytes };
  });
  registerTrustedIpcHandler("desktop:local-storage:materialize-remote-asset", trustPolicy, async (input) => {
    if (!isRemoteMaterializationInput(input) || !materializer) throw new Error("Invalid remote asset materialization input.");
    return materializer.materialize(input);
  });
  registerTrustedIpcHandler(
    "desktop:local-storage:materialize-chapter-narration",
    trustPolicy,
    async (input) => {
      if (!isChapterNarrationMaterializationInput(input) || !materializer) {
        throw new Error("Invalid chapter narration materialization input.");
      }
      return materializer.materializeChapterNarration(input);
    },
  );
  registerTrustedIpcHandlerWithEvent("desktop:local-storage:repair-selected-asset", trustPolicy, async (event, input) => {
    if (!isSelectedAssetCommitInput(input)) throw new Error("Invalid selected asset repair input.");
    const selection = pendingAssetSelections.consume(input.selectionToken, event.sender.id, "asset-import");
    if (selection.kind !== input.kind) throw new Error("Local asset kind changed before repair.");
    return storage.registerAsset(input.projectId, { assetId: input.assetId, kind: input.kind, sourcePath: selection.sourcePath });
  });
  registerTrustedIpcHandler(
    "desktop:local-storage:ensure-project",
    trustPolicy,
    async (projectId) => {
      if (typeof projectId !== "string") throw new Error("projectId must be a string.");
      const manifest = await storage.ensureProject(projectId);
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
    const kind = kindForPath(sourcePath);
    const [checksumSha256, durationMs] = await Promise.all([
      sha256File(sourcePath),
      selectedMediaDuration(kind, sourcePath),
    ]);
    const selectionToken = pendingAssetSelections.create(event.sender.id, "asset-import", { sourcePath, kind });
    return {
      selectionToken,
      originalFilename: basename(sourcePath),
      contentType: contentTypeForPath(sourcePath),
      sizeBytes: file.size,
      checksumSha256,
      kind,
      ...(durationMs == null ? {} : { durationMs }),
    };
  });
  registerTrustedIpcHandlerWithEvent("desktop:local-storage:commit-selected-asset", trustPolicy, async (event, input) => {
    if (!isSelectedAssetCommitInput(input)) throw new Error("Invalid selected asset commit input.");
    const selection = pendingAssetSelections.consume(input.selectionToken, event.sender.id, "asset-import");
    if (selection.kind !== input.kind) throw new Error("Local asset kind changed before commit.");
    return storage.registerAsset(input.projectId, { assetId: input.assetId, kind: input.kind, sourcePath: selection.sourcePath });
  });
  registerTrustedIpcHandler(
    "desktop:local-storage:reveal-artifact",
    trustPolicy,
    async (input) => {
      if (!isArtifactInput(input)) throw new Error("Invalid local artifact input.");
      const path = await storage.resolveArtifact(input.projectId, input.jobId);
      const error = await shell.openPath(path);
      if (error) throw new Error(error);
    },
  );

async function selectedMediaDuration(
  kind: "IMAGE" | "AUDIO" | "VIDEO" | "OTHER",
  sourcePath: string,
): Promise<number | undefined> {
  if (kind !== "AUDIO" && kind !== "VIDEO") return undefined;
  const ffprobePath = ffmpegRuntime.ffprobePath;
  if (!ffprobePath) return undefined;
  try {
    return await probeMediaDuration(ffprobePath, sourcePath);
  } catch (error) {
    throw new Error(
      `Không đọc được thời lượng ${kind === "VIDEO" ? "video" : "audio"}: ${
        error instanceof Error ? error.message : "ffprobe failed"
      }`,
    );
  }
}
}

function isSelectedAssetCommitInput(value: unknown): value is {
  projectId: string;
  assetId: string;
  kind: "IMAGE" | "AUDIO" | "VIDEO" | "OTHER";
  selectionToken: string;
}
 {
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

function isArtifactInput(value: unknown): value is { projectId: string; jobId: string } {
  if (!value || typeof value !== "object") return false;
  const input = value as Record<string, unknown>;
  return typeof input.projectId === "string" && typeof input.jobId === "string";
}

function isRemoteMaterializationInput(value: unknown): value is { projectId: string; assetId: string } {
  if (!value || typeof value !== "object") return false;
  const input = value as Record<string, unknown>;
  return typeof input.projectId === "string" && typeof input.assetId === "string";
}

function isChapterNarrationMaterializationInput(value: unknown): value is {
  projectId: string;
  chapterId: string;
  assetId: string;
  sizeBytes: number;
  checksumSha256: string;
}
 {
  if (!value || typeof value !== "object") return false;
  const input = value as Record<string, unknown>;
  return (
    typeof input.projectId === "string" &&
    typeof input.chapterId === "string" &&
    typeof input.assetId === "string" &&
    typeof input.sizeBytes === "number" &&
    typeof input.checksumSha256 === "string"
  );
}
