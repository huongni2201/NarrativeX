import os from "node:os";
import type { LocalExecutionConfig } from "./config";

interface ApiEnvelope<T> {
  success: boolean;
  message?: string;
  data?: T;
}

export interface PairDeviceResponse {
  deviceId: string;
  deviceToken: string;
}

export interface ClaimedProjectRenderChapter {
  chapterId: string;
  orderIndex: number;
  globalStartMs: number;
  globalEndMs: number;
  narrationAssetId: string;
  sizeBytes: number;
  checksum: string;
  durationMs: number;
}

export interface ClaimedProjectRenderBeat {
  chapterId: string;
  sceneIndex: number;
  beatIndex: number;
  visualBeatId: string;
  mediaAssetId: string;
  globalStartMs: number;
  globalEndMs: number;
  durationMs: number;
  cameraMovement: string;
  sizeBytes: number;
  checksum: string;
}

export interface ClaimedProjectRender {
  jobId: string;
  projectId: string;
  storyVersionId: string;
  resolution: string;
  format: string;
  aspectRatio: string;
  totalDurationMs: number;
  renderProfileJson: string;
  leaseToken: string;
  chapters: ClaimedProjectRenderChapter[];
  beats: ClaimedProjectRenderBeat[];
}

export interface LocalRenderCompletion {
  renderFingerprint: string;
  localArtifactKey: string;
  mimeType: "video/mp4";
  sizeBytes: number;
  checksumSha256: string;
  durationMs: number;
  width: number;
  height: number;
  fps: number;
}

export class LocalExecutionBackendClient {
  constructor(
    private readonly config: LocalExecutionConfig,
    private readonly appVersion: string,
  ) {}

  async pair(pairingCode: string): Promise<PairDeviceResponse> {
    return this.request<PairDeviceResponse>("/api/v1/local-devices/pair", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pairingCode,
        name: os.hostname(),
        platform: `${process.platform}-${process.arch}`,
        agentVersion: this.appVersion,
        capabilities: this.config.capabilities,
      }),
    });
  }

  async heartbeat(deviceToken: string): Promise<void> {
    await this.deviceRequest<void>(deviceToken, "/api/v1/local-devices/heartbeat", {
      method: "POST",
      body: JSON.stringify({
        agentVersion: this.appVersion,
        capabilities: this.config.capabilities,
      }),
    });
  }

  async claimProjectRender(deviceToken: string): Promise<ClaimedProjectRender | null> {
    const response = await fetch(
      `${this.config.backendBaseUrl}/api/v1/local-devices/project-renders/claim`,
      {
        method: "POST",
        headers: { "X-NX-Device-Token": deviceToken },
      },
    );
    if (response.status === 204) return null;
    return this.parseEnvelope<ClaimedProjectRender>(response);
  }

  async heartbeatProjectRender(
    deviceToken: string,
    jobId: string,
    leaseToken: string,
  ): Promise<void> {
    await this.deviceRequest<void>(
      deviceToken,
      `/api/v1/local-devices/project-renders/${encodeURIComponent(jobId)}/heartbeat`,
      { method: "POST", body: JSON.stringify({ leaseToken }) },
    );
  }

  async reportProjectRenderProgress(
    deviceToken: string,
    jobId: string,
    leaseToken: string,
    progress: number,
    currentStep: string,
  ): Promise<void> {
    await this.deviceRequest<void>(
      deviceToken,
      `/api/v1/local-devices/project-renders/${encodeURIComponent(jobId)}/progress`,
      {
        method: "POST",
        body: JSON.stringify({ leaseToken, progress, currentStep }),
      },
    );
  }

  async completeProjectRender(
    deviceToken: string,
    jobId: string,
    leaseToken: string,
    completion: LocalRenderCompletion,
  ): Promise<void> {
    await this.deviceRequest<void>(
      deviceToken,
      `/api/v1/local-devices/project-renders/${encodeURIComponent(jobId)}/complete`,
      {
        method: "POST",
        body: JSON.stringify({ leaseToken, ...completion }),
      },
    );
  }

  async cancelProjectRender(
    deviceToken: string,
    jobId: string,
    leaseToken: string,
  ): Promise<void> {
    await this.deviceRequest<void>(
      deviceToken,
      `/api/v1/local-devices/project-renders/${encodeURIComponent(jobId)}/cancel`,
      {
        method: "POST",
        body: JSON.stringify({ leaseToken }),
      },
    );
  }

  async failProjectRender(
    deviceToken: string,
    jobId: string,
    leaseToken: string,
    errorCode: string,
    retryable: boolean,
  ): Promise<void> {
    await this.deviceRequest<void>(
      deviceToken,
      `/api/v1/local-devices/project-renders/${encodeURIComponent(jobId)}/fail`,
      {
        method: "POST",
        body: JSON.stringify({ leaseToken, errorCode, retryable }),
      },
    );
  }

  private async deviceRequest<T>(
    deviceToken: string,
    path: string,
    init: RequestInit,
  ): Promise<T> {
    const headers = new Headers(init.headers);
    headers.set("Content-Type", "application/json");
    headers.set("X-NX-Device-Token", deviceToken);
    return this.request<T>(path, { ...init, headers });
  }

  private async request<T>(path: string, init: RequestInit): Promise<T> {
    const response = await fetch(`${this.config.backendBaseUrl}${path}`, init);
    return this.parseEnvelope<T>(response);
  }

  private async parseEnvelope<T>(response: Response): Promise<T> {
    let payload: ApiEnvelope<T> | null = null;
    try {
      payload = (await response.json()) as ApiEnvelope<T>;
    } catch {
      // Fall through to the HTTP status below.
    }
    if (!response.ok || payload?.success !== true) {
      throw new Error(payload?.message || `Backend request failed (${response.status}).`);
    }
    return payload.data as T;
  }
}
