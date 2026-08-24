import { EventEmitter } from "node:events";
import type { ProjectStorage } from "../local-storage/project-storage";
import type { LocalExecutionConfig } from "./config";
import { DeviceIdentityStore, type DeviceIdentity } from "./device-identity";
import {
  LocalExecutionBackendClient,
  type ClaimedProjectRender,
} from "./backend-client";

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

export interface PreparedProjectRender extends ClaimedProjectRender {
  chapters: Array<ClaimedProjectRender["chapters"][number] & { localPath: string }>;
  beats: Array<ClaimedProjectRender["beats"][number] & { localPath: string }>;
}

export class LocalExecutionService extends EventEmitter {
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private identity: DeviceIdentity | null = null;
  private state: LocalExecutionConnectionState = "UNPAIRED";
  private lastError: string | null = null;

  constructor(
    private readonly config: LocalExecutionConfig,
    private readonly identityStore: DeviceIdentityStore,
    private readonly backendClient: LocalExecutionBackendClient,
    private readonly projectStorage: ProjectStorage,
  ) {
    super();
  }

  async start(): Promise<void> {
    this.identity = await this.identityStore.load();
    if (!this.identity) {
      this.setState("UNPAIRED", null);
      return;
    }
    await this.startHeartbeat();
  }

  async pair(pairingCode: string): Promise<LocalExecutionStatus> {
    const normalized = pairingCode.trim().toUpperCase();
    if (!normalized) throw new Error("Pairing code is required.");
    this.setState("CONNECTING", null);
    try {
      const paired = await this.backendClient.pair(normalized);
      this.identity = { deviceId: paired.deviceId, deviceToken: paired.deviceToken };
      await this.identityStore.save(this.identity);
      await this.startHeartbeat();
      return this.status();
    } catch (error) {
      this.identity = null;
      this.setState("UNPAIRED", errorMessage(error));
      throw error;
    }
  }

  async unpair(): Promise<LocalExecutionStatus> {
    this.stopHeartbeat();
    this.identity = null;
    await this.identityStore.clear();
    this.setState("UNPAIRED", null);
    return this.status();
  }

  status(): LocalExecutionStatus {
    return {
      state: this.state,
      backendBaseUrl: this.config.backendBaseUrl,
      deviceId: this.identity?.deviceId ?? null,
      capabilities: [...this.config.capabilities],
      projectRenderEnabled: this.config.projectRenderEnabled,
      lastError: this.lastError,
    };
  }

  async prepareNextProjectRender(): Promise<PreparedProjectRender | null> {
    if (!this.config.projectRenderEnabled) {
      throw new Error(
        "Local project rendering is disabled until the desktop FFmpeg runtime is enabled.",
      );
    }
    if (!this.identity) throw new Error("Desktop device is not paired.");
    const claimed = await this.backendClient.claimProjectRender(this.identity.deviceToken);
    if (!claimed) return null;

    try {
      const chapters = await Promise.all(
        claimed.chapters.map(async (chapter) => ({
          ...chapter,
          localPath: await this.projectStorage.resolveAsset(
            claimed.projectId,
            chapter.narrationAssetId,
            { sizeBytes: chapter.sizeBytes, checksumSha256: chapter.checksum },
          ),
        })),
      );
      const beats = await Promise.all(
        claimed.beats.map(async (beat) => ({
          ...beat,
          localPath: await this.projectStorage.resolveAsset(claimed.projectId, beat.mediaAssetId, {
            sizeBytes: beat.sizeBytes,
            checksumSha256: beat.checksum,
          }),
        })),
      );
      return { ...claimed, chapters, beats };
    } catch (error) {
      await this.backendClient.failProjectRender(
        this.identity.deviceToken,
        claimed.jobId,
        claimed.leaseToken,
        "LOCAL_ASSET_MISSING_OR_INVALID",
        false,
      );
      throw error;
    }
  }

  stop(): void {
    this.stopHeartbeat();
  }

  private async startHeartbeat(): Promise<void> {
    this.stopHeartbeat();
    await this.sendHeartbeat();
    this.heartbeatTimer = setInterval(
      () => void this.sendHeartbeat(),
      this.config.heartbeatIntervalMs,
    );
  }

  private async sendHeartbeat(): Promise<void> {
    if (!this.identity) {
      this.setState("UNPAIRED", null);
      return;
    }
    this.setState(this.state === "ONLINE" ? "ONLINE" : "CONNECTING", null);
    try {
      await this.backendClient.heartbeat(this.identity.deviceToken);
      this.setState("ONLINE", null);
    } catch (error) {
      this.setState("OFFLINE", errorMessage(error));
    }
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    this.heartbeatTimer = null;
  }

  private setState(state: LocalExecutionConnectionState, lastError: string | null): void {
    const changed = this.state !== state || this.lastError !== lastError;
    this.state = state;
    this.lastError = lastError;
    if (changed) this.emit("status", this.status());
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Local execution request failed.";
}
