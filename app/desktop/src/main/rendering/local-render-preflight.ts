import { statfs } from "node:fs/promises";
import type { LocalRenderPreflight, LocalRenderPreflightAsset } from "@narrativex/client-contracts";
import type { ProjectStorage } from "../local-storage/project-storage";
import type { FfmpegRuntimeStatus } from "./ffmpeg-runtime";

export interface LocalRenderPreflightInput {
  projectId: string;
  assetIds: string[];
  estimatedOutputBytes: number;
  requiredTemporaryBytes: number;
}

export class LocalRenderPreflightService {
  constructor(
    private readonly runtime: FfmpegRuntimeStatus,
    private readonly storage: ProjectStorage,
  ) {}

  async check(input: LocalRenderPreflightInput, localExecutorOnline: boolean): Promise<LocalRenderPreflight> {
    const blockers: string[] = [];
    const warnings: string[] = [];
    const assets: LocalRenderPreflightAsset[] = [];
    const assetIds = [...new Set(input.assetIds.filter(Boolean))];
    if (!this.runtime.available || !this.runtime.ffmpegPath || !this.runtime.ffprobePath) blockers.push("FFmpeg/ffprobe chưa sẵn sàng trên desktop.");
    if (!localExecutorOnline) blockers.push("Local executor chưa ONLINE hoặc chưa pair với tài khoản.");

    let diskFreeBytes: number | null = null;
    try {
      const disk = await statfs(this.storage.projectDirectory(input.projectId));
      diskFreeBytes = disk.bavail * disk.bsize;
      const requiredBytes = Math.max(0, input.estimatedOutputBytes) + Math.max(0, input.requiredTemporaryBytes);
      if (diskFreeBytes < requiredBytes) blockers.push(`Không đủ dung lượng: cần khoảng ${formatBytes(requiredBytes)}, còn ${formatBytes(diskFreeBytes)}.`);
    } catch (error) {
      warnings.push(`Không đọc được dung lượng đĩa: ${error instanceof Error ? error.message : "unknown error"}.`);
    }

    for (const assetId of assetIds) {
      try {
        await this.storage.resolveAsset(input.projectId, assetId);
        assets.push({ assetId, state: "AVAILABLE", message: null });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Asset không hợp lệ.";
        const state = /missing|not registered/i.test(message) ? "MISSING" : "CORRUPT";
        assets.push({ assetId, state, message });
        blockers.push(`${assetId}: ${message}`);
      }
    }

    return {
      ready: blockers.length === 0,
      blockers,
      warnings,
      assets,
      diskFreeBytes,
      estimatedOutputBytes: Math.max(0, input.estimatedOutputBytes),
      requiredTemporaryBytes: Math.max(0, input.requiredTemporaryBytes),
    };
  }
}

function formatBytes(bytes: number): string {
  if (bytes < 1024 ** 2) return `${Math.round(bytes / 1024)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
}
