import { mkdir, rm, stat } from "node:fs/promises";
import { join } from "node:path";
import type { LocalRenderCompletion } from "../local-execution/backend-client";
import type { PreparedProjectRender } from "../local-execution/service";
import type { ProjectStorage } from "../local-storage/project-storage";
import { concatNarration } from "./audio-concat";
import { muxNarration } from "./audio-muxer";
import { probeVideo } from "./ffprobe";
import type { FfmpegRuntimeStatus } from "./ffmpeg-runtime";
import { RenderExecutionError } from "./render-errors";
import { buildLocalRenderManifest, renderDimensions } from "./render-manifest";
import { parseRenderProfile } from "./render-profile";
import { renderSegments, renderWorkingDimensions } from "./segment-renderer";
import { concatVideo } from "./video-concat";
import {
  renderConcurrencyForWorkload,
  resolveVideoEncoderForProfile,
} from "./video-encoder";
import { RenderJournalStore, type RenderJournal, type RenderJournalStage } from "./render-journal";

export class ProjectRenderer {
  constructor(
    private readonly runtime: FfmpegRuntimeStatus,
    private readonly storage: ProjectStorage,
    private readonly journals = new RenderJournalStore(storage.rootDirectory()),
  ) {}

  async render(
    prepared: PreparedProjectRender,
    signal: AbortSignal,
    onProgress: (progress: number, step: string) => Promise<void>,
  ): Promise<LocalRenderCompletion> {
    if (!this.runtime.available || !this.runtime.ffmpegPath || !this.runtime.ffprobePath) {
      throw new RenderExecutionError(
        "FFMPEG_UNAVAILABLE",
        "FFmpeg runtime is unavailable.",
        false,
      );
    }

    const profile = parseRenderProfile(prepared.renderProfileJson);
    const dimensions = renderDimensions(prepared.resolution, prepared.aspectRatio);
    const videoEncoder = await resolveVideoEncoderForProfile(
      this.runtime.ffmpegPath,
      this.runtime.videoEncoder === "h264_nvenc",
      profile.video,
      dimensions.width,
      dimensions.height,
    );
    const manifest = buildLocalRenderManifest(prepared, videoEncoder);
    const movingStillBeats = manifest.beats.filter(
      (beat) => beat.mediaType === "IMAGE" && beat.cameraMovement.trim().toUpperCase() !== "NONE",
    );
    const working = movingStillBeats.reduce(
      (largest, beat) => {
        const current = renderWorkingDimensions(
          manifest.width,
          manifest.height,
          true,
          beat.cameraMovement,
          manifest.fps,
        );
        return {
          width: Math.max(largest.width, current.width),
          height: Math.max(largest.height, current.height),
        };
      },
      { width: manifest.width, height: manifest.height },
    );
    const hasMovingStills = movingStillBeats.length > 0;
    const renderConcurrency = renderConcurrencyForWorkload(
      videoEncoder,
      working.width,
      working.height,
      manifest.fps,
      hasMovingStills,
    );

    const workDirectory = join(
      this.storage.projectDirectory(prepared.projectId),
      "work",
      prepared.jobId,
    );
    await mkdir(workDirectory, { recursive: true });
    let journal = await this.journals.load(prepared.projectId, prepared.jobId);
    if (journal && journal.renderFingerprint !== manifest.renderFingerprint) {
      throw new RenderExecutionError("RENDER_CHECKPOINT_MISMATCH", "Saved render checkpoint does not match the current render snapshot.", false);
    }
    if (journal?.stage === "FAILED" || journal?.stage === "CANCELLED") {
      throw new RenderExecutionError(
        "RENDER_RETRY_REQUIRED",
        "This render attempt is terminal. Start an explicit retry to create a new attempt.",
        false,
      );
    }
    journal ??= { version: 1, projectId: prepared.projectId, jobId: prepared.jobId, renderFingerprint: manifest.renderFingerprint, stage: "CLAIMED", workDirectory, updatedAt: new Date().toISOString() };
    await this.journals.save(journal);

    if (journal.stage === "COMPLETED") {
      try {
        const finalPath = await this.storage.resolveArtifact(prepared.projectId, prepared.jobId);
        const metadata = await probeVideo(this.runtime.ffprobePath, finalPath);
        return completion(manifest.renderFingerprint, metadata, await this.storage.artifactEntry(prepared.projectId, prepared.jobId));
      } catch (error) {
        const failure = asRenderFailure("RENDER_COMPLETED_ARTIFACT_INVALID", error);
        await this.journals.fail(journal, failure.code, "VERIFY", failure.message, false);
        throw failure;
      }
    }

    const finalPath = join(workDirectory, "final.mp4");
    if (journal.stage === "REGISTER" || journal.stage === "VERIFY") {
      try {
        if (await isFile(finalPath)) {
          const metadata = await probeVideo(this.runtime.ffprobePath, finalPath);
          if (journal.stage === "VERIFY") {
            journal = await this.journals.advance(journal, "REGISTER");
          }
          const artifact = await this.storage.registerArtifact(prepared.projectId, {
            jobId: prepared.jobId,
            sourcePath: finalPath,
          });
          await onProgress(99, "Artifact registered");
          await this.journals.advance(journal, "COMPLETED");
          return completion(manifest.renderFingerprint, metadata, artifact);
        }
      } catch (error) {
        if (isUserCancellation(error)) {
          await this.journals.advance(journal, "CANCELLED");
          throw error;
        }
        if (isResumableInterruption(error)) throw error;
        const failure = asRenderFailure(
          journal.stage === "VERIFY" ? "RENDER_VERIFY_FAILED" : "RENDER_REGISTER_FAILED",
          error,
        );
        await this.journals.fail(journal, failure.code, journal.stage, failure.message, failure.retryable);
        throw failure;
      }
    }

    let currentStage: RenderJournalStage = journal.stage;
    const checkpoint = async (stage: RenderJournalStage) => {
      journal = await this.journals.advance(journal!, stage);
      currentStage = stage;
    };

    try {
      await cleanupInterruptedOutputs(workDirectory);
      await onProgress(5, "Preparing local render manifest");
      await checkpoint("MATERIALIZING");
      await checkpoint("SEGMENT_RENDER");
      const segments = await renderSegments(
        this.runtime.ffmpegPath,
        workDirectory,
        manifest,
        signal,
        join(this.storage.projectDirectory(prepared.projectId), "cache", "segments"),
        {
          videoEncoder,
          concurrency: renderConcurrency,
        },
      );
      await onProgress(85, "Concatenating video segments");
      await checkpoint("VIDEO_CONCAT");
      const video = await concatVideo(this.runtime.ffmpegPath, workDirectory, segments, signal);
      await onProgress(93, "Concatenating narration audio");
      await checkpoint("AUDIO_CONCAT");
      const audio = await concatNarration(this.runtime.ffmpegPath, workDirectory, manifest, signal);
      await onProgress(97, "Muxing audio");
      await checkpoint("MUX");
      const renderedFinalPath = await muxNarration(
        this.runtime.ffmpegPath,
        workDirectory,
        video,
        audio,
        signal,
      );
      await onProgress(98, "Validating final artifact");
      await checkpoint("VERIFY");
      let metadata: Awaited<ReturnType<typeof probeVideo>>;
      try {
        metadata = await probeVideo(this.runtime.ffprobePath, renderedFinalPath);
      } catch (error) {
        throw asRenderFailure("RENDER_VERIFY_FAILED", error);
      }
      await checkpoint("REGISTER");
      let artifact;
      try {
        artifact = await this.storage.registerArtifact(prepared.projectId, {
          jobId: prepared.jobId,
          sourcePath: renderedFinalPath,
        });
      } catch (error) {
        throw asRenderFailure("RENDER_REGISTER_FAILED", error);
      }
      await onProgress(99, "Artifact registered");
      await this.journals.advance(journal, "COMPLETED");
      return completion(manifest.renderFingerprint, metadata, artifact);
    } catch (error) {
      if (isUserCancellation(error)) {
        await this.journals.advance(journal, "CANCELLED");
        throw error;
      }
      if (isResumableInterruption(error)) throw error;
      const failure = error instanceof RenderExecutionError
        ? error
        : new RenderExecutionError("LOCAL_RENDER_FAILED", errorMessage(error), true);
      await this.journals.fail(journal, failure.code, currentStage, failure.message, failure.retryable);
      throw failure;
    }
  }
}

function completion(
  renderFingerprint: string,
  metadata: Awaited<ReturnType<typeof probeVideo>>,
  artifact: { relativePath: string; sizeBytes: number; checksumSha256: string },
): LocalRenderCompletion {
  return {
    renderFingerprint,
    localArtifactKey: artifact.relativePath,
    mimeType: metadata.mimeType,
    sizeBytes: artifact.sizeBytes,
    checksumSha256: artifact.checksumSha256,
    durationMs: metadata.durationMs,
    width: metadata.width,
    height: metadata.height,
    fps: metadata.fps,
  };
}

function asRenderFailure(code: string, error: unknown): RenderExecutionError {
  return new RenderExecutionError(code, errorMessage(error), true);
}

function isUserCancellation(error: unknown): boolean {
  return error instanceof RenderExecutionError && error.code === "RENDER_CANCELLED";
}

function isResumableInterruption(error: unknown): boolean {
  return error instanceof RenderExecutionError &&
    (error.code === "RENDER_INTERRUPTED" || error.code === "RENDER_LEASE_LOST");
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Local render failed.";
}

async function isFile(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isFile();
  } catch (error) {
    return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT"
      ? false
      : Promise.reject(error);
  }
}

async function cleanupInterruptedOutputs(workDirectory: string): Promise<void> {
  await Promise.all([
    rm(join(workDirectory, "segments"), { recursive: true, force: true }),
    rm(join(workDirectory, "subtitles"), { recursive: true, force: true }),
    rm(join(workDirectory, "video.mp4"), { force: true }),
    rm(join(workDirectory, "narration.m4a"), { force: true }),
    rm(join(workDirectory, "subtitles.srt"), { force: true }),
    rm(join(workDirectory, "final.mp4"), { force: true }),
  ]);
}
