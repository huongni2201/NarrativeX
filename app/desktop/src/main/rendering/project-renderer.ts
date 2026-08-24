import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import type { LocalExecutionBackendClient, LocalRenderCompletion } from "../local-execution/backend-client";
import type { PreparedProjectRender } from "../local-execution/service";
import type { ProjectStorage } from "../local-storage/project-storage";
import { concatNarration } from "./audio-concat";
import { muxNarration } from "./audio-muxer";
import { probeVideo } from "./ffprobe";
import { RenderExecutionError } from "./render-errors";
import { buildLocalRenderManifest } from "./render-manifest";
import { concatVideo } from "./video-concat";
import { renderSegments } from "./segment-renderer";
import type { FfmpegRuntimeStatus } from "./ffmpeg-runtime";

export class ProjectRenderer {
  constructor(private readonly runtime: FfmpegRuntimeStatus, private readonly storage: ProjectStorage) {}

  async render(prepared: PreparedProjectRender, signal: AbortSignal, onProgress: (progress: number, step: string) => Promise<void>): Promise<LocalRenderCompletion> {
    if (!this.runtime.available || !this.runtime.ffmpegPath || !this.runtime.ffprobePath) throw new RenderExecutionError("FFMPEG_UNAVAILABLE", "FFmpeg runtime is unavailable.", false);
    const manifest = buildLocalRenderManifest(prepared);
    const workDirectory = join(this.storage.projectDirectory(prepared.projectId), "work", prepared.jobId);
    await mkdir(workDirectory, { recursive: true });
    await onProgress(5, "Preparing local render manifest");
    const segments = await renderSegments(this.runtime.ffmpegPath, workDirectory, manifest, signal);
    await onProgress(85, "Concatenating video segments");
    const video = await concatVideo(this.runtime.ffmpegPath, workDirectory, segments, signal);
    await onProgress(93, "Concatenating narration audio");
    const audio = await concatNarration(this.runtime.ffmpegPath, workDirectory, manifest, signal);
    await onProgress(97, "Muxing audio");
    const finalPath = await muxNarration(this.runtime.ffmpegPath, workDirectory, video, audio, signal);
    await onProgress(98, "Validating final artifact");
    const metadata = await probeVideo(this.runtime.ffprobePath, finalPath);
    const artifact = await this.storage.registerArtifact(prepared.projectId, { jobId: prepared.jobId, sourcePath: finalPath });
    await onProgress(99, "Artifact registered");
    return { renderFingerprint: manifest.renderFingerprint, localArtifactKey: artifact.relativePath, mimeType: metadata.mimeType, sizeBytes: artifact.sizeBytes, checksumSha256: artifact.checksumSha256, durationMs: metadata.durationMs, width: metadata.width, height: metadata.height, fps: metadata.fps };
  }
}
