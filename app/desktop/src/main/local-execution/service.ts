import { EventEmitter } from "node:events";
import type { ProjectStorage } from "../local-storage/project-storage";
import type { ProjectRenderer } from "../rendering/project-renderer";
import { RenderExecutionError } from "../rendering/render-errors";
import {
  LocalExecutionBackendClient,
  type ClaimedProjectRender,
  type LocalRenderCompletion,
} from "./backend-client";
import type { LocalExecutionConfig } from "./config";
import { DeviceIdentityStore, type DeviceIdentity } from "./device-identity";

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
  chapters: Array<
    ClaimedProjectRender["chapters"][number] & { localPath: string }
  >;
  beats: Array<ClaimedProjectRender["beats"][number] & { localPath: string }>;
}

export class LocalExecutionService extends EventEmitter {
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private identity: DeviceIdentity | null = null;
  private state: LocalExecutionConnectionState = "UNPAIRED";
  private lastError: string | null = null;
  private renderPollTimer: NodeJS.Timeout | null = null;
  private renderInFlight = false;
  private activeRender: { jobId: string; controller: AbortController } | null = null;

  constructor(
    private readonly config: LocalExecutionConfig,
    private readonly identityStore: DeviceIdentityStore,
    private readonly backendClient: LocalExecutionBackendClient,
    private readonly projectStorage: ProjectStorage,
    private readonly projectRenderer?: ProjectRenderer,
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
    this.stopRenderPolling();
    this.abortActiveRender(
      new RenderExecutionError(
        "RENDER_INTERRUPTED",
        "Local device was unpaired while rendering.",
        true,
      ),
    );
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

  async executeNextProjectRender(): Promise<LocalRenderCompletion | null> {
    const identity = this.identity;
    if (!this.projectRenderer || !identity || this.state !== "ONLINE") return null;

    const prepared = await this.prepareNextProjectRender(identity);
    if (!prepared) return null;

    const controller = new AbortController();
    this.activeRender = { jobId: prepared.jobId, controller };
    let leaseLost = false;
    const leaseTimer = setInterval(() => {
      void this.backendClient
        .heartbeatProjectRender(
          identity.deviceToken,
          prepared.jobId,
          prepared.leaseToken,
        )
        .catch(() => {
          leaseLost = true;
          controller.abort(
            new RenderExecutionError(
              "RENDER_LEASE_LOST",
              "Project render lease was lost.",
              true,
            ),
          );
        });
    }, Math.max(5_000, Math.floor(this.config.heartbeatIntervalMs / 2)));

    try {
      const completion = await this.projectRenderer.render(
        prepared,
        controller.signal,
        async (progress, currentStep) => {
          if (leaseLost) {
            throw new RenderExecutionError(
              "RENDER_LEASE_LOST",
              "Project render lease was lost.",
              true,
            );
          }
          try {
            await this.backendClient.reportProjectRenderProgress(
              identity.deviceToken,
              prepared.jobId,
              prepared.leaseToken,
              progress,
              currentStep,
            );
          } catch (error) {
            leaseLost = true;
            controller.abort(
              new RenderExecutionError(
                "RENDER_LEASE_LOST",
                "Project render lease was lost while reporting progress.",
                true,
              ),
            );
            throw error;
          }
        },
      );

      if (leaseLost) {
        throw new RenderExecutionError(
          "RENDER_LEASE_LOST",
          "Project render lease was lost before completion.",
          true,
        );
      }

      await this.backendClient.completeProjectRender(
        identity.deviceToken,
        prepared.jobId,
        prepared.leaseToken,
        completion,
      );
      return completion;
    } catch (error) {
      if (!leaseLost) {
        if (isRenderCancellation(error)) {
          await this.persistCancellation(identity, prepared);
        } else {
          const failure = renderFailure(error);
          await this.backendClient
            .failProjectRender(
              identity.deviceToken,
              prepared.jobId,
              prepared.leaseToken,
              failure.code,
              failure.retryable,
            )
            .catch(() => undefined);
        }
      }
      throw error;
    } finally {
      clearInterval(leaseTimer);
      if (this.activeRender?.jobId === prepared.jobId) this.activeRender = null;
    }
  }

  cancelProjectRender(jobId: string): boolean {
    if (this.activeRender?.jobId !== jobId) return false;
    this.activeRender.controller.abort(
      new RenderExecutionError("RENDER_CANCELLED", "Render was cancelled.", false),
    );
    return true;
  }

  stop(): void {
    this.stopHeartbeat();
    this.stopRenderPolling();
    this.abortActiveRender(
      new RenderExecutionError(
        "RENDER_INTERRUPTED",
        "Desktop execution stopped while rendering.",
        true,
      ),
    );
  }

  private async persistCancellation(
    identity: DeviceIdentity,
    prepared: PreparedProjectRender,
  ): Promise<void> {
    try {
      await this.backendClient.cancelProjectRender(
        identity.deviceToken,
        prepared.jobId,
        prepared.leaseToken,
      );
    } catch {
      // A failed cancel request must never make a user-cancelled render claimable again.
      // Persist a terminal failure as the fallback if the dedicated cancel transition fails.
      await this.backendClient
        .failProjectRender(
          identity.deviceToken,
          prepared.jobId,
          prepared.leaseToken,
          "RENDER_CANCELLED",
          false,
        )
        .catch(() => undefined);
    }
  }

  private async prepareNextProjectRender(
    identity: DeviceIdentity,
  ): Promise<PreparedProjectRender | null> {
    if (!this.config.projectRenderEnabled) {
      throw new Error(
        "Local project rendering is disabled until the desktop FFmpeg runtime is enabled.",
      );
    }

    const claimed = await this.backendClient.claimProjectRender(identity.deviceToken);
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
          localPath: await this.projectStorage.resolveAsset(
            claimed.projectId,
            beat.mediaAssetId,
            { sizeBytes: beat.sizeBytes, checksumSha256: beat.checksum },
          ),
        })),
      );
      return { ...claimed, chapters, beats };
    } catch (error) {
      await this.backendClient.failProjectRender(
        identity.deviceToken,
        claimed.jobId,
        claimed.leaseToken,
        "LOCAL_ASSET_MISSING_OR_INVALID",
        false,
      );
      throw error;
    }
  }

  private async startHeartbeat(): Promise<void> {
    this.stopHeartbeat();
    await this.sendHeartbeat();
    this.heartbeatTimer = setInterval(
      () => void this.sendHeartbeat(),
      this.config.heartbeatIntervalMs,
    );
    this.startRenderPolling();
  }

  private startRenderPolling(): void {
    if (!this.projectRenderer || this.renderPollTimer) return;
    this.renderPollTimer = setInterval(() => void this.tryRenderNext(), 5_000);
    void this.tryRenderNext();
  }

  private stopRenderPolling(): void {
    if (this.renderPollTimer) clearInterval(this.renderPollTimer);
    this.renderPollTimer = null;
  }

  private async tryRenderNext(): Promise<void> {
    if (this.renderInFlight || this.state !== "ONLINE") return;
    this.renderInFlight = true;
    try {
      await this.executeNextProjectRender();
    } catch (error) {
      if (!isRenderCancellation(error)) {
        this.lastError = errorMessage(error);
        this.emit("status", this.status());
      }
    } finally {
      this.renderInFlight = false;
    }
  }

  private async sendHeartbeat(): Promise<void> {
    const identity = this.identity;
    if (!identity) {
      this.setState("UNPAIRED", null);
      return;
    }

    this.setState(this.state === "ONLINE" ? "ONLINE" : "CONNECTING", null);
    try {
      await this.backendClient.heartbeat(identity.deviceToken);
      if (this.identity?.deviceId === identity.deviceId) {
        this.setState("ONLINE", null);
      }
    } catch (error) {
      if (this.identity?.deviceId === identity.deviceId) {
        this.setState("OFFLINE", errorMessage(error));
      }
    }
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    this.heartbeatTimer = null;
  }

  private abortActiveRender(reason: RenderExecutionError): void {
    if (this.activeRender && !this.activeRender.controller.signal.aborted) {
      this.activeRender.controller.abort(reason);
    }
  }

  private setState(
    state: LocalExecutionConnectionState,
    lastError: string | null,
  ): void {
    const changed = this.state !== state || this.lastError !== lastError;
    this.state = state;
    this.lastError = lastError;
    if (changed) this.emit("status", this.status());
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Local execution request failed.";
}

function isRenderCancellation(error: unknown): boolean {
  return error instanceof RenderExecutionError && error.code === "RENDER_CANCELLED";
}

function renderFailure(error: unknown): { code: string; retryable: boolean } {
  if (error instanceof RenderExecutionError) {
    return { code: error.code, retryable: error.retryable };
  }
  if (
    error &&
    typeof error === "object" &&
    "code" in error &&
    typeof error.code === "string"
  ) {
    return {
      code: error.code,
      retryable:
        "retryable" in error && typeof error.retryable === "boolean"
          ? error.retryable
          : true,
    };
  }
  return { code: "LOCAL_RENDER_FAILED", retryable: true };
}
