import type { LocalRenderPreflight } from "@narrativex/client-contracts";

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
  projectDirectory: string;
  assetCount: number;
  artifactCount: number;
}

export interface LocalStorageSummary {
  projectId: string;
  projectDirectory: string;
  totalBytes: number;
  assetBytes: number;
  artifactBytes: number;
  workBytes: number;
  assetCount: number;
  artifactCount: number;
}

export interface LocalProjectBackup {
  projectId: string;
  backupDirectory: string;
  manifestSchemaVersion: number;
  createdAt: string;
  sizeBytes: number;
}

export interface LocalProjectRestoreResult {
  projectId: string;
  projectDirectory: string;
  previousProjectDirectory: string | null;
  restoredFrom: string;
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
}

export interface LocalRemoteMaterializationInput {
  projectId: string;
  assetId: string;
  kind: "IMAGE" | "AUDIO" | "VIDEO";
  downloadUrl: string;
  sizeBytes: number;
  checksumSha256: string;
  filename: string;
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
  unfinished: Array<{ projectId: string; jobId: string; stage: string; updatedAt: string; renderFingerprint: string }>;
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

export interface NarrativeXDesktopBridge {
  appVersion(): Promise<string>;
  api: {
    request(input: DesktopApiRequest): Promise<DesktopApiResponse>;
  };
  auth: {
    login(): Promise<void>;
    onCallback(listener: (code: string) => void): () => void;
  };
  localExecution: {
    status(): Promise<LocalExecutionStatus>;
    setUser(userId: string | null): Promise<LocalExecutionStatus>;
    pair(pairingCode: string): Promise<LocalExecutionStatus>;
    unpair(): Promise<LocalExecutionStatus>;
    onStatusChanged(listener: (status: LocalExecutionStatus) => void): () => void;
  };
  localStorage: {
    ensureProject(projectId: string): Promise<LocalProjectStorageStatus>;
    summary(projectId: string): Promise<LocalStorageSummary>;
    verifyProject(projectId: string): Promise<Array<{ assetId: string; state: "AVAILABLE" | "MISSING" | "CORRUPT" }>>;
    cleanupCompletedWork(projectId: string): Promise<number>;
    createBackup(input: { projectId: string; destinationDirectory: string }): Promise<LocalProjectBackup>;
    restoreBackup(input: { backupDirectory: string; replaceExisting?: boolean }): Promise<LocalProjectRestoreResult>;
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
  render: {
    status(): Promise<FfmpegRuntimeStatus>;
    preflight(input: LocalRenderPreflightInput): Promise<LocalRenderPreflight>;
    recoveryStatus(): Promise<RenderRecoveryStatus>;
    cancel(jobId: string): Promise<boolean>;
  };
  system: {
    selectFiles(): Promise<string[]>;
    selectFolder(): Promise<string | null>;
  };
  windowControls: {
    minimize(): Promise<void>;
    toggleMaximize(): Promise<boolean>;
    close(): Promise<void>;
  };
}
