import { statfs } from "node:fs/promises";
import type {
  LocalRenderPreflight,
  LocalRenderPreflightAsset,
  LocalRenderPreflightAssetInput,
  LocalRenderPreflightBlockerCode,
} from "@narrativex/client-contracts";
import type { ProjectStorage } from "../local-storage/project-storage";
import type { FfmpegRuntimeStatus } from "./ffmpeg-runtime";
import type { LocalExecutionConnectionState } from "../local-execution/service";

export interface LocalRenderPreflightInput {
  projectId: string;
  assets: LocalRenderPreflightAssetInput[];
  estimatedOutputBytes: number;
  requiredTemporaryBytes: number;
}

export interface LocalRenderPreflightContext {
  state: LocalExecutionConnectionState;
  currentUserValid: boolean;
  devicePaired: boolean;
}

export class LocalRenderPreflightService {
  private readonly runtime: FfmpegRuntimeStatus;
  private readonly storage: ProjectStorage;

  constructor(
    runtime: FfmpegRuntimeStatus,
    storage: ProjectStorage,
  ) {
    this.runtime = runtime;
    this.storage = storage;
  }

  async check(
    input: LocalRenderPreflightInput,
    context: LocalRenderPreflightContext,
  ): Promise<LocalRenderPreflight> {
    const blockers: LocalRenderPreflightBlockerCode[] = [];
    const warnings: string[] = [];
    const assets: LocalRenderPreflightAsset[] = [];
    const descriptors = dedupeAssets(input.assets);

    if (!this.runtime.available || !this.runtime.ffmpegPath || !this.runtime.ffprobePath) {
      blockers.push("FFMPEG_UNAVAILABLE");
    }
    if (!context.currentUserValid) blockers.push("USER_MISMATCH");
    if (!context.devicePaired) blockers.push("DEVICE_MISMATCH");
    if (context.state !== "ONLINE") {
      const blocker = executorBlockerCode(context.state);
      if (!blockers.includes(blocker)) blockers.push(blocker);
    }

    let diskFreeBytes: number | null = null;
    try {
      const disk = await statfs(this.storage.projectDirectory(input.projectId));
      diskFreeBytes = disk.bavail * disk.bsize;
      const requiredBytes = Math.max(0, input.estimatedOutputBytes) + Math.max(0, input.requiredTemporaryBytes);
      if (diskFreeBytes < requiredBytes) blockers.push("INSUFFICIENT_DISK");
    } catch (error) {
      warnings.push(`Không đọc được dung lượng đĩa: ${error instanceof Error ? error.message : "unknown error"}.`);
      blockers.push("DISK_UNKNOWN");
    }

    for (const descriptor of descriptors) {
      try {
        await this.storage.resolveAsset(input.projectId, descriptor.assetId);
        assets.push({ assetId: descriptor.assetId, state: "AVAILABLE", message: null });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Asset không hợp lệ.";
        const missing = /missing|not registered/i.test(message);
        if (missing && descriptor.materializable && descriptor.storageMode !== "LOCAL_ONLY") {
          assets.push({
            assetId: descriptor.assetId,
            state: "MATERIALIZABLE",
            message: null,
          });
          continue;
        }

        const state = missing ? "MISSING" : "CORRUPT";
        assets.push({ assetId: descriptor.assetId, state, message });
        const blocker = state === "MISSING" ? "ASSET_MISSING" : "ASSET_CORRUPT";
        if (!blockers.includes(blocker)) blockers.push(blocker);
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

function dedupeAssets(assets: LocalRenderPreflightAssetInput[]): LocalRenderPreflightAssetInput[] {
  const byId = new Map<string, LocalRenderPreflightAssetInput>();
  for (const asset of assets) {
    if (!asset.assetId) continue;
    const current = byId.get(asset.assetId);
    if (!current) {
      byId.set(asset.assetId, asset);
      continue;
    }
    byId.set(asset.assetId, {
      assetId: asset.assetId,
      storageMode:
        current.storageMode === "LOCAL_ONLY" || asset.storageMode === "LOCAL_ONLY"
          ? "LOCAL_ONLY"
          : current.storageMode === "HYBRID" || asset.storageMode === "HYBRID"
            ? "HYBRID"
            : "REMOTE",
      materializable: current.materializable || asset.materializable,
    });
  }
  return [...byId.values()];
}

export function executorBlockerCode(
  state: LocalExecutionConnectionState,
): Exclude<LocalRenderPreflightBlockerCode, "FFMPEG_UNAVAILABLE" | "DEVICE_MISMATCH" | "USER_MISMATCH" | "INSUFFICIENT_DISK" | "DISK_UNKNOWN" | "ASSET_MISSING" | "ASSET_CORRUPT"> {
  if (state === "UNPAIRED") return "EXECUTOR_UNPAIRED";
  if (state === "CONNECTING") return "EXECUTOR_CONNECTING";
  if (state === "OFFLINE") return "EXECUTOR_OFFLINE";
  throw new Error("ONLINE executor does not have a blocker.");
}
