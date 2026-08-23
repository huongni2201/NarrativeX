import os from "node:os";
import type { AgentConfig } from "./config";

interface ApiEnvelope<T> {
  success: boolean;
  message: string;
  data: T;
}

interface PairDeviceResponse {
  deviceId: string;
  deviceToken: string;
}

export class BackendClient {
  constructor(private readonly config: AgentConfig) {}

  async pair(pairingCode: string): Promise<PairDeviceResponse> {
    return this.request<PairDeviceResponse>("/api/v1/local-devices/pair", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pairingCode,
        name: os.hostname(),
        platform: `${process.platform}-${process.arch}`,
        agentVersion: process.env.npm_package_version ?? "0.1.0",
        capabilities: ["GEMINI_WEB"],
      }),
    });
  }

  async heartbeat(deviceToken: string): Promise<void> {
    await this.request<void>("/api/v1/local-devices/heartbeat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-NX-Device-Token": deviceToken,
      },
      body: JSON.stringify({
        agentVersion: process.env.npm_package_version ?? "0.1.0",
        capabilities: ["GEMINI_WEB"],
      }),
    });
  }

  private async request<T>(path: string, init: RequestInit): Promise<T> {
    const response = await fetch(`${this.config.backendBaseUrl}${path}`, init);
    const payload = (await response.json()) as ApiEnvelope<T>;
    if (!response.ok || !payload.success) {
      throw new Error(payload.message || `Backend request failed (${response.status})`);
    }
    return payload.data;
  }
}
