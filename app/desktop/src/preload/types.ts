import type { DesktopProject, LocalRenderPreflight } from "@narrativex/client-contracts";
import type { GeminiWebLane as GeminiWebLaneType } from "../shared/gemini-web-lanes";
export type { GeminiWebLane } from "../shared/gemini-web-lanes";

export type LocalExecutionConnectionState =
  | "UNPAIRED"
  | "CONNECTING"
  | "ONLINE"
  | "OFFLINE";

export interface LocalExecutionStatus {
  state: LocalExecutionConnectionState;
  backendBaseUrl: string;
  deviceId: string | null;
  capabilities: string[];
  projectRenderEnabled: boolean;
  unfinishedRenderCount: number;
  lastError: string | null;
}

export interface LocalProjectStorageStatus {
  projectId: string;
  assetCount: number;
  artifactCount: number;
}

export type LocalProjectSyncStatus =
  | "LOCAL_ONLY"
  | "DIRTY"
  | "SYNCING"
  | "SYNCED"
  | "SYNC_FAILED";

export interface LocalProjectCatalogEntry {
  project: DesktopProject;
  workspacePath: string;
  ownerId: string | null;
  cloudProjectId: string | null;
  syncStatus: LocalProjectSyncStatus;
  registeredAt: string;
  lastOpenedAt: string;
}

export interface LocalProjectCatalogMetadata {
  ownerId?: string | null;
  cloudProjectId?: string | null;
  syncStatus?: LocalProjectSyncStatus;
}

export interface LocalStorageSummary {
  projectId: string;
  totalBytes: number;
  assetBytes: number;
  artifactBytes: number;
  workBytes: number;
  cacheBytes: number;
  backupBytes: number;
  managedBackupBytes: number;
  preRestoreSnapshotBytes: number;
  otherNarrativeXOwnedBytes: number;
  assetCount: number;
  artifactCount: number;
  managedSnapshots: Array<{
    snapshotId: string;
    type: "BACKUP" | "PRE_RESTORE";
    createdAt: string;
    sizeBytes: number;
  }>;
}

export interface LocalProjectBackup {
  projectId: string;
  snapshotId: string;
  manifestSchemaVersion: number;
  createdAt: string;
  sizeBytes: number;
}

export interface LocalProjectRestoreResult {
  projectId: string;
  replacedExisting: boolean;
  previousProjectSnapshotId: string | null;
}

export interface LocalProjectArchiveResult {
  projectId: string;
  sizeBytes: number;
}

export interface LocalAssetImportResult {
  assetId: string;
  kind: "IMAGE" | "AUDIO" | "VIDEO" | "OTHER";
  relativePath: string;
  sizeBytes: number;
  checksumSha256: string;
}

export interface LocalAssetSelection {
  selectionToken: string;
  originalFilename: string;
  contentType: string;
  sizeBytes: number;
  checksumSha256: string;
  kind: "IMAGE" | "AUDIO" | "VIDEO" | "OTHER";
  /** ffprobe-derived duration for audio/video. Undefined when not applicable or ffprobe is unavailable. */
  durationMs?: number;
}

export interface GeminiWebReferenceInput {
  refLabel: string;
  assetId: string;
  characterId: string;
  canonicalName: string;
  beatRole?: string | null;
}

export interface GeminiWebGenerateImageInput {
  lane: GeminiWebLaneType;
  prompt: string;
  projectId?: string;
  references?: GeminiWebReferenceInput[];
}

export interface VoiceReferenceUploadResult {
  assetId: string;
  status: string;
  originalFilename: string;
  contentType: string;
  sizeBytes: number;
  checksumSha256: string;
}

export interface LocalRemoteMaterializationInput {
  projectId: string;
  assetId: string;
}

export interface FfmpegRuntimeStatus {
  available: boolean;
  ffmpegPath: string | null;
  ffprobePath: string | null;
  version: string | null;
  reason: string | null;
}

export interface LocalRenderPreflightInput {
  projectId: string;
  assetIds: string[];
  estimatedOutputBytes: number;
  requiredTemporaryBytes: number;
}

export interface RenderRecoveryStatus {
  unfinished: Array<{ projectId: string; jobId: string; stage: string; recoveryAction: string; updatedAt: string; renderFingerprint: string }>;
}

export interface DesktopApiRequest {
  path: string;
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  timeoutMs?: number;
}

export interface DesktopApiResponse {
  status: number;
  statusText: string;
  bodyText: string;
}

export interface DesktopSseEvent {
  event: string;
  data: string;
  id: string | null;
  retry: number | null;
}

export interface DesktopSseHandlers {
  onEvent(event: DesktopSseEvent): void;
  onError?(message: string): void;
}

export interface NarrativeXDesktopBridge {
  appVersion(): Promise<string>;
  api: {
    request(input: DesktopApiRequest): Promise<DesktopApiResponse>;
    subscribe(path: string, handlers: DesktopSseHandlers): () => void;
    uploadVoiceReference(): Promise<VoiceReferenceUploadResult | null>;
  };
  auth: {
    login(): Promise<void>;
    logout(): Promise<DesktopApiResponse>;
    onCallback(listener: (response: DesktopApiResponse) => void): () => void;
  };
  localExecution: {
    status(): Promise<LocalExecutionStatus>;
    setUser(userId: string | null): Promise<LocalExecutionStatus>;
    pair(pairingCode: string): Promise<LocalExecutionStatus>;
    unpair(): Promise<LocalExecutionStatus>;
    onStatusChanged(listener: (status: LocalExecutionStatus) => void): () => void;
  };
  localProjects: {
    list(): Promise<LocalProjectCatalogEntry[]>;
    lastOpened(): Promise<LocalProjectCatalogEntry | null>;
    upsert(project: DesktopProject, metadata?: LocalProjectCatalogMetadata): Promise<LocalProjectCatalogEntry>;
    reconcile(projects: DesktopProject[], metadata?: LocalProjectCatalogMetadata): Promise<LocalProjectCatalogEntry[]>;
    touch(projectId: string): Promise<LocalProjectCatalogEntry>;
    markArchived(projectId: string): Promise<void>;
  };
  localStorage: {
    ensureProject(projectId: string): Promise<LocalProjectStorageStatus>;
    summary(projectId: string): Promise<LocalStorageSummary>;
    deleteManagedSnapshot(input: { projectId: string; snapshotId: string }): Promise<boolean>;
    verifyProject(projectId: string): Promise<Array<{ assetId: string; state: "AVAILABLE" | "MISSING" | "CORRUPT" }>>;
    cleanupCompletedWork(projectId: string): Promise<number>;
    createBackup(projectId: string): Promise<LocalProjectBackup | null>;
    restoreBackup(): Promise<LocalProjectRestoreResult | null>;
    archiveProject(projectId: string): Promise<LocalProjectArchiveResult | null>;
    materializeRemoteAsset(input: LocalRemoteMaterializationInput): Promise<LocalAssetImportResult>;
    repairSelectedAsset(input: { projectId: string; assetId: string; kind: "IMAGE" | "AUDIO" | "VIDEO"; selectionToken: string }): Promise<LocalAssetImportResult>;
    selectAsset(): Promise<LocalAssetSelection | null>;
    commitSelectedAsset(input: {
      projectId: string;
      assetId: string;
      kind: "IMAGE" | "AUDIO" | "VIDEO" | "OTHER";
      selectionToken: string;
    }): Promise<LocalAssetImportResult>;
    revealArtifact(input: { projectId: string; jobId: string }): Promise<void>;
  };
  geminiWeb: {
    generateImage(input: GeminiWebGenerateImageInput): Promise<LocalAssetSelection>;
    commitImage(input: {
      lane: GeminiWebLaneType;
      projectId: string;
      assetId: string;
      selectionToken: string;
    }): Promise<LocalAssetImportResult>;
  };
  render: {
    status(): Promise<FfmpegRuntimeStatus>;
    preflight(input: LocalRenderPreflightInput): Promise<LocalRenderPreflight>;
    recoveryStatus(): Promise<RenderRecoveryStatus>;
    cancel(jobId: string): Promise<boolean>;
  };
  system: {
    copyText(text: string): Promise<void>;
  };
  windowControls: {
    minimize(): Promise<void>;
    toggleMaximize(): Promise<boolean>;
    close(): Promise<void>;
  };
}
