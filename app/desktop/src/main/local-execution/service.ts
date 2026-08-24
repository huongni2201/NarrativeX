import { randomUUID } from "node:crypto";
import { EventEmitter } from "node:events";
import { createWriteStream } from "node:fs";
import { rm } from "node:fs/promises";
import { extname, join } from "node:path";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { ProjectStorage } from "../local-storage/project-storage";
import type { ProjectRenderer } from "../rendering/project-renderer";
import { RenderExecutionError } from "../rendering/render-errors";
import {
  LocalExecutionBackendClient,
  LocalExecutionBackendError,
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
  private sessionUserId: string | null = null;
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
    const loadedIdentity = await this.identityStore.load();
    this.identity = loadedIdentity;
    if (!loadedIdentity) {
      this.setState("UNPAIRED", null);
      return;
    }

    const sessionUserId = this.sessionUserId;
    if (!sessionUserId) {
      this.setState("OFFLINE", null);
      return;
    }
    if (loadedIdentity.userId !== sessionUserId) {
      this.identity = null;
      await this.identityStore.clear();
      this.setState("UNPAIRED", null);
      return;
    }
    await this.startHeartbeat();
  }

  async setUser(userId: string | null): Promise<LocalExecutionStatus> {
    const normalized = userId?.trim() || null;
    if (!normalized) {
      this.sessionUserId = null;
      this.stopHeartbeat();
      this.stopRenderPolling();
      this.abortActiveRender(
        new RenderExecutionError(
          "RENDER_INTERRUPTED",
          "NarrativeX user session ended while rendering.",
          true,
        ),
      );
      this.setState(this.identity ? "OFFLINE" : "UNPAIRED", null);
      return this.status();
    }

    this.sessionUserId = normalized;
    if (!this.identity) {
      this.setState("UNPAIRED", null);
      return this.status();
    }

    if (this.identity.userId !== normalized) {
      this.stopHeartbeat();
      this.stopRenderPolling();
      this.abortActiveRender(
        new RenderExecutionError(
          "RENDER_INTERRUPTED",
          "NarrativeX account changed while rendering.",
          true,
        ),
      );
      this.identity = null;
      await this.identityStore.clear();
      this.setState("UNPAIRED", null);
      return this.status();
    }

    if (this.heartbeatTimer && (this.state === "ONLINE" || this.state === "CONNECTING")) {
      return this.status();
    }
    await this.startHeartbeat();
    return this.status();
  }

  async pair(pairingCode: string): Promise<LocalExecutionStatus> {
    const normalized = pairingCode.trim().toUpperCase();
    if (!normalized) throw new Error("Pairing code is required.");
    const sessionUserId = this.sessionUserId;
    if (!sessionUserId) {
      throw new Error("Sign in to NarrativeX before pairing this desktop device.");
    }

    this.setState("CONNECTING", null);
    try {
      const paired = await this.backendClient.pair(normalized);
      if (paired.userId !== sessionUserId) {
        throw new Error("Pairing code belongs to a different NarrativeX user.");
      }
      this.identity = {
        deviceId: paired.deviceId,
        userId: paired.userId,
        deviceToken: paired.deviceToken,
      };
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
    if (
      !this.projectRenderer ||
      !identity ||
      !this.sessionUserId ||
      identity.userId !== this.sessionUserId ||
      this.state !== "ONLINE"
    ) {
      return null;
    }
    if (!this.config.projectRenderEnabled) {
      throw new Error(
        "Local project rendering is disabled until the desktop FFmpeg runtime is enabled.",
      );
    }

    const claimed = await this.backendClient.claimProjectRender(identity.deviceToken);
    if (!claimed) return null;

    const controller = new AbortController();
    this.activeRender = { jobId: claimed.jobId, controller };
    let leaseLost = false;
    const leaseTimer = setInterval(() => {
      void this.backendClient
        .heartbeatProjectRender(
          identity.deviceToken,
          claimed.jobId,
          claimed.leaseToken,
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
      const prepared = await this.prepareClaimedProjectRender(claimed, controller.signal);
      if (leaseLost) {
        throw new RenderExecutionError(
          "RENDER_LEASE_LOST",
          "Project render lease was lost while preparing local assets.",
          true,
        );
      }

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
              claimed.jobId,
              claimed.leaseToken,
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
        claimed.jobId,
        claimed.leaseToken,
        completion,
      );
      return completion;
    } catch (error) {
      if (!leaseLost) {
        if (isRenderCancellation(error)) {
          await this.persistCancellation(identity, claimed);
        } else {
          const failure = renderFailure(error);
          await this.backendClient
            .failProjectRender(
              identity.deviceToken,
              claimed.jobId,
              claimed.leaseToken,
              failure.code,
              failure.retryable,
            )
            .catch(() => undefined);
        }
      }
      throw error;
    } finally {
      clearInterval(leaseTimer);
      if (this.activeRender?.jobId === claimed.jobId) this.activeRender = null;
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
    this.sessionUserId = null;
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
    claimed: ClaimedProjectRender,
  ): Promise<void> {
    try {
      await this.backendClient.cancelProjectRender(
        identity.deviceToken,
        claimed.jobId,
        claimed.leaseToken,
      );
    } catch {
      await this.backendClient
        .failProjectRender(
          identity.deviceToken,
          claimed.jobId,
          claimed.leaseToken,
          "RENDER_CANCELLED",
          false,
        )
        .catch(() => undefined);
    }
  }

  private async prepareClaimedProjectRender(
    claimed: ClaimedProjectRender,
    signal: AbortSignal,
  ): Promise<PreparedProjectRender> {
    try {
      const chapters = await mapWithConcurrency(claimed.chapters, 2, async (chapter) => ({
        ...chapter,
        localPath: await this.resolveRenderAsset(
          claimed.projectId,
          narrationCacheKey(chapter.narrationAssetId, chapter.checksum),
          "AUDIO",
          chapter.downloadUrl,
          chapter.sizeBytes,
          chapter.checksum,
          signal,
        ),
      }));
      const beats = await mapWithConcurrency(claimed.beats, 4, async (beat) => ({
        ...beat,
        localPath: await this.resolveRenderAsset(
          claimed.projectId,
          beat.mediaAssetId,
          "IMAGE",
          beat.downloadUrl,
          beat.sizeBytes,
          beat.checksum,
          signal,
        ),
      }));
      return { ...claimed, chapters, beats };
    } catch (error) {
      if (signal.aborted) throw signal.reason ?? error;
      throw new RenderExecutionError(
        "LOCAL_ASSET_MISSING_OR_INVALID",
        errorMessage(error),
        false,
      );
    }
  }

  private async resolveRenderAsset(
    projectId: string,
    assetId: string,
    kind: "IMAGE" | "AUDIO",
    downloadUrl: string | null,
    sizeBytes: number,
    checksumSha256: string,
    signal: AbortSignal,
  ): Promise<string> {
    const expected = { sizeBytes, checksumSha256 };
    try {
      return await this.projectStorage.resolveAsset(projectId, assetId, expected);
    } catch (localError) {
      if (!downloadUrl) throw localError;
    }

    signal.throwIfAborted();
    await this.projectStorage.ensureProject(projectId);
    const temporaryPath = join(
      this.projectStorage.projectDirectory(projectId),
      "work",
      `.asset-${assetId}-${randomUUID()}${downloadExtension(downloadUrl)}`,
    );
    try {
      await downloadVerifiedFile(downloadUrl, temporaryPath, sizeBytes, signal);
      signal.throwIfAborted();
      await this.projectStorage.registerAsset(projectId, {
        assetId,
        kind,
        sourcePath: temporaryPath,
        checksumSha256,
      });
      return await this.projectStorage.resolveAsset(projectId, assetId, expected);
    } finally {
      await rm(temporaryPath, { force: true }).catch(() => undefined);
    }
  }

  private async startHeartbeat(): Promise<void> {
    this.stopHeartbeat();
    await this.sendHeartbeat();
    if (this.state !== "ONLINE") return;
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
    if (!this.sessionUserId || identity.userId !== this.sessionUserId) {
      this.setState("OFFLINE", null);
      return;
    }

    this.setState(this.state === "ONLINE" ? "ONLINE" : "CONNECTING", null);
    try {
      await this.backendClient.heartbeat(identity.deviceToken);
      if (
        this.identity?.deviceId === identity.deviceId &&
        this.sessionUserId === identity.userId
      ) {
        this.setState("ONLINE", null);
      }
    } catch (error) {
      if (
        this.identity?.deviceId !== identity.deviceId ||
        this.sessionUserId !== identity.userId
      ) {
        return;
      }
      if (isDeviceAuthenticationFailure(error)) {
        this.stopHeartbeat();
        this.stopRenderPolling();
        this.identity = null;
        await this.identityStore.clear().catch(() => undefined);
        this.setState("UNPAIRED", null);
        return;
      }
      this.setState("OFFLINE", errorMessage(error));
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

function narrationCacheKey(narrationAssetId: string | null, checksumSha256: string): string {
  return narrationAssetId ?? `audio-${checksumSha256.toLowerCase()}`;
}

function isDeviceAuthenticationFailure(error: unknown): boolean {
  return (
    error instanceof LocalExecutionBackendError &&
    (error.status === 401 || error.status === 403)
  );
}

async function downloadVerifiedFile(
  downloadUrl: string,
  destination: string,
  expectedSizeBytes: number,
  signal: AbortSignal,
): Promise<void> {
  const url = new URL(downloadUrl);
  if (
    url.protocol !== "https:" &&
    !(url.protocol === "http:" && isLoopbackHost(url.hostname))
  ) {
    throw new Error("Local render asset URL must use HTTPS outside localhost.");
  }

  const response = await fetch(url, { method: "GET", redirect: "error", signal });
  if (!response.ok || !response.body) {
    throw new Error(`Local render asset download failed (${response.status}).`);
  }

  const declaredSize = response.headers.get("content-length");
  if (declaredSize) {
    const parsed = Number(declaredSize);
    if (Number.isFinite(parsed) && parsed >= 0 && parsed !== expectedSizeBytes) {
      throw new Error("Local render asset download size does not match the render snapshot.");
    }
  }

  let bytesWritten = 0;
  const sizeGuard = new Transform({
    transform(chunk: Buffer, _encoding, callback) {
      bytesWritten += chunk.length;
      if (bytesWritten > expectedSizeBytes) {
        callback(new Error("Local render asset download exceeded the render snapshot size."));
        return;
      }
      callback(null, chunk);
    },
  });
  const body = Readable.fromWeb(
    response.body as import("node:stream/web").ReadableStream<Uint8Array>,
  );
  await pipeline(body, sizeGuard, createWriteStream(destination, { flags: "wx" }), { signal });
  if (bytesWritten !== expectedSizeBytes) {
    throw new Error("Local render asset download is incomplete.");
  }
}

function downloadExtension(downloadUrl: string): string {
  const value = extname(new URL(downloadUrl).pathname).toLowerCase();
  return /^\.[a-z0-9]{1,10}$/.test(value) ? value : ".bin";
}

function isLoopbackHost(hostname: string): boolean {
  const value = hostname.toLowerCase();
  return value === "localhost" || value === "127.0.0.1" || value === "[::1]";
}

async function mapWithConcurrency<T, R>(
  values: readonly T[],
  concurrency: number,
  mapper: (value: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(values.length);
  let nextIndex = 0;
  const workers = Array.from(
    { length: Math.min(Math.max(1, concurrency), values.length) },
    async () => {
      while (true) {
        const index = nextIndex++;
        if (index >= values.length) return;
        results[index] = await mapper(values[index]);
      }
    },
  );
  await Promise.all(workers);
  return results;
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
