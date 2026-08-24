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
  lastError: string | null;
}

export interface LocalProjectStorageStatus {
  projectId: string;
  projectDirectory: string;
  assetCount: number;
  artifactCount: number;
}

export interface LocalAssetImportResult {
  assetId: string;
  kind: "IMAGE" | "AUDIO" | "VIDEO" | "OTHER";
  relativePath: string;
  sizeBytes: number;
  checksumSha256: string;
}

export interface FfmpegRuntimeStatus {
  available: boolean;
  ffmpegPath: string | null;
  ffprobePath: string | null;
  version: string | null;
  reason: string | null;
}

export interface DesktopApiRequest {
  path: string;
  method?: string;
  headers?: Record<string, string>;
  body?: string;
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
    pair(pairingCode: string): Promise<LocalExecutionStatus>;
    unpair(): Promise<LocalExecutionStatus>;
    onStatusChanged(listener: (status: LocalExecutionStatus) => void): () => void;
  };
  localStorage: {
    ensureProject(projectId: string): Promise<LocalProjectStorageStatus>;
    importAsset(input: {
      projectId: string;
      assetId: string;
      kind: "IMAGE" | "AUDIO" | "VIDEO" | "OTHER";
    }): Promise<LocalAssetImportResult | null>;
    revealArtifact(input: { projectId: string; jobId: string }): Promise<void>;
  };
  render: {
    status(): Promise<FfmpegRuntimeStatus>;
    cancel(jobId: string): Promise<boolean>;
  };
  system: {
    selectFiles(): Promise<string[]>;
    selectFolder(): Promise<string | null>;
  };
}
