import { createHash } from "node:crypto";
import { compositionPolicyForBeat } from "../../shared/image-motion.ts";
import { renderProjectFrameWindows } from "../../shared/render-frame-clock.ts";
import type { VideoEncoder, VideoQualityProfile } from "../../shared/video-encoding.ts";
import type {
  ClaimedProjectRender,
  ClaimedProjectRenderBeat,
  ClaimedProjectRenderChapter,
} from "../local-execution/backend-client";
import { parseRenderProfile, type RenderColorMode } from "./render-profile";
import { planSubtitles, type PlannedSubtitle } from "./subtitle-planner";
import { planBeatTransitions } from "./transition-planner";

const SHA256_PATTERN = /^[0-9a-f]{64}$/i;
const VIDEO_FIT_MODES = new Set(["TRIM", "LOOP", "FREEZE_END", "SPEED_ADJUST"]);

export interface LocalRenderManifest {
  readonly version: 1;
  readonly jobId: string;
  readonly projectId: string;
  readonly renderFingerprint: string;
  readonly renderProfileSchemaVersion: 3;
  readonly rendererVersion: "project-image-motion-v3-composition";
  readonly compositionPolicyVersion: 1;
  readonly width: number;
  readonly height: number;
  readonly fps: 30 | 60;
  readonly videoEncoder: VideoEncoder;
  readonly videoQuality: VideoQualityProfile;
  readonly colorMode: RenderColorMode;
  readonly watermark: {
    readonly mode: "required" | "none";
    readonly policyVersion: 1;
  };
  readonly beats: readonly LocalRenderBeat[];
  readonly audio: { readonly chapters: readonly LocalRenderAudio[] };
  readonly subtitles: readonly PlannedSubtitle[];
  readonly effects: {
    readonly transitionPolicy: "CHAPTER_FADE_BLACK_V1";
    readonly subtitlePolicy: "BURN_IN_ALIGNMENT_V1" | "NONE";
  };
  readonly output: { readonly format: "mp4"; readonly mimeType: "video/mp4" };
}

export interface LocalRenderBeat
  extends Omit<ClaimedProjectRenderBeat, "localPath"> {
  readonly localPath: string;
  readonly startFrame: number;
  readonly endFrame: number;
  readonly frameCount: number;
  readonly framing: "COVER" | "CONTAIN";
  readonly motionEasing: "LINEAR" | "SMOOTHSTEP";
  readonly transitionInMs: number;
  readonly transitionOutMs: number;
}

export interface LocalRenderAudio
  extends Omit<ClaimedProjectRenderChapter, "localPath"> {
  readonly localPath: string;
}

export function buildLocalRenderManifest(
  render: ClaimedProjectRender & {
    chapters: Array<ClaimedProjectRenderChapter & { localPath: string }>;
    beats: Array<ClaimedProjectRenderBeat & { localPath: string }>;
  },
  videoEncoder: VideoEncoder = "libx264",
): LocalRenderManifest {
  const { width, height } = renderDimensions(render.resolution, render.aspectRatio);
  const profile = parseRenderProfile(render.renderProfileJson);
  const subtitlesEnabled = profile.subtitleMode !== "none";
  validateTimeline(render);

  const renderBeats = render.beats as Array<ClaimedProjectRenderBeat & { localPath: string }>;
  const renderChapters = render.chapters as Array<ClaimedProjectRenderChapter & { localPath: string }>;
  const orderedForTransitions = [...renderBeats].sort(
    (left, right) =>
      left.globalStartMs - right.globalStartMs ||
      left.sceneIndex - right.sceneIndex ||
      left.beatIndex - right.beatIndex,
  );
  const frameWindows = renderProjectFrameWindows(
    orderedForTransitions.map((beat) => ({ startMs: beat.globalStartMs, endMs: beat.globalEndMs })),
    render.totalDurationMs,
    profile.fps,
  );
  const frameWindowByBeat = new Map(
    orderedForTransitions.map((beat, index) => [beat.visualBeatId, frameWindows[index]!] as const),
  );
  const transitionByBeat = new Map(
    planBeatTransitions(orderedForTransitions).map((plan) => [plan.visualBeatId, plan]),
  );
  const beats = renderBeats.map(({ localPath, ...beat }) => {
    const transition = transitionByBeat.get(beat.visualBeatId);
    const frameWindow = frameWindowByBeat.get(beat.visualBeatId);
    if (!frameWindow) throw new Error(`Missing render frame window for ${beat.visualBeatId}.`);
    const composition = compositionPolicyForBeat(beat.mediaType, beat.cameraMovement, {
      transitionInMs: transition?.transitionInMs ?? 0,
      transitionOutMs: transition?.transitionOutMs ?? 0,
    });
    return {
      ...beat,
      localPath,
      startFrame: frameWindow.startFrame,
      endFrame: frameWindow.endFrame,
      frameCount: frameWindow.frameCount,
      framing: composition.framing,
      motionEasing: composition.motionEasing,
      transitionInMs: transition?.transitionInMs ?? 0,
      transitionOutMs: transition?.transitionOutMs ?? 0,
    };
  });
  const audio = {
    chapters: renderChapters.map(({ localPath, ...chapter }) => ({
      ...chapter,
      localPath,
    })),
  };
  const subtitles = subtitlesEnabled ? planSubtitles(renderChapters) : [];
  const effects = {
    transitionPolicy: "CHAPTER_FADE_BLACK_V1" as const,
    subtitlePolicy: subtitlesEnabled ? ("BURN_IN_ALIGNMENT_V1" as const) : ("NONE" as const),
  };
  const fingerprintSource = canonicalize({
    version: 1,
    jobId: render.jobId,
    projectId: render.projectId,
    renderProfileSchemaVersion: profile.schemaVersion,
    rendererVersion: profile.rendererVersion,
    compositionPolicyVersion: profile.compositionPolicyVersion,
    width,
    height,
    fps: profile.fps,
    videoEncoder,
    videoQuality: profile.video,
    colorMode: profile.colorMode,
    watermark: profile.watermark,
    beats: beats.map(({ localPath: _path, ...beat }) => beat),
    audio: {
      chapters: audio.chapters.map(({ localPath: _path, ...chapter }) => chapter),
    },
    subtitles,
    effects,
    output: { format: "mp4" },
  });

  return deepFreeze({
    version: 1 as const,
    jobId: render.jobId,
    projectId: render.projectId,
    renderFingerprint: createHash("sha256").update(fingerprintSource).digest("hex"),
    renderProfileSchemaVersion: profile.schemaVersion,
    rendererVersion: profile.rendererVersion,
    compositionPolicyVersion: profile.compositionPolicyVersion,
    width,
    height,
    fps: profile.fps,
    videoEncoder,
    videoQuality: profile.video,
    colorMode: profile.colorMode,
    watermark: profile.watermark,
    beats,
    audio,
    subtitles,
    effects,
    output: { format: "mp4" as const, mimeType: "video/mp4" as const },
  });
}

export function renderDimensions(
  resolution: string,
  aspectRatio: string,
): { width: number; height: number } {
  const explicit = resolution.match(/^(\d+)x(\d+)$/i);
  if (explicit) {
    return { width: Number(explicit[1]), height: Number(explicit[2]) };
  }

  const sizes: Record<string, number> = {
    "720p": 720,
    "1080p": 1080,
    "1440p": 1440,
    "2160p": 2160,
  };
  const base = sizes[resolution.toLowerCase()];
  if (!base) throw new Error(`Unsupported render resolution: ${resolution}`);

  const ratio = aspectRatio.match(/^(\d+):(\d+)$/);
  if (!ratio) throw new Error(`Unsupported render aspect ratio: ${aspectRatio}`);
  const ratioWidth = Number(ratio[1]);
  const ratioHeight = Number(ratio[2]);
  if (ratioWidth <= 0 || ratioHeight <= 0) {
    throw new Error(`Unsupported render aspect ratio: ${aspectRatio}`);
  }

  if (ratioWidth >= ratioHeight) {
    return {
      width: evenDimension((base * ratioWidth) / ratioHeight),
      height: base,
    };
  }
  return {
    width: base,
    height: evenDimension((base * ratioHeight) / ratioWidth),
  };
}

function evenDimension(value: number): number {
  return Math.max(2, Math.round(value / 2) * 2);
}

function validateTimeline(render: ClaimedProjectRender): void {
  const chapters = [...render.chapters].sort(
    (a, b) => a.globalStartMs - b.globalStartMs || a.orderIndex - b.orderIndex,
  );
  if (chapters.length === 0) throw new Error("Project render has no narration chapters.");

  let chapterClock = 0;
  for (const chapter of chapters) {
    const duration = chapter.globalEndMs - chapter.globalStartMs;
    if (
      chapter.globalStartMs !== chapterClock ||
      duration <= 0 ||
      chapter.durationMs !== duration ||
      chapter.sizeBytes <= 0 ||
      !SHA256_PATTERN.test(chapter.checksum)
    ) {
      throw new Error(`Invalid narration chapter ${chapter.chapterId}.`);
    }
    chapterClock = chapter.globalEndMs;
  }
  if (chapterClock !== render.totalDurationMs) {
    throw new Error("Narration timeline does not match the project duration.");
  }

  const beats = [...render.beats].sort(
    (a, b) =>
      a.globalStartMs - b.globalStartMs ||
      a.sceneIndex - b.sceneIndex ||
      a.beatIndex - b.beatIndex,
  );
  if (beats.length === 0) throw new Error("Project render has no visual beats.");

  let visualClock = 0;
  for (const beat of beats) {
    const duration = beat.globalEndMs - beat.globalStartMs;
    if (
      beat.globalStartMs !== visualClock ||
      duration <= 0 ||
      beat.durationMs !== duration ||
      !beat.mediaAssetId ||
      beat.sizeBytes <= 0 ||
      !SHA256_PATTERN.test(beat.checksum)
    ) {
      throw new Error(`Invalid visual beat ${beat.visualBeatId}.`);
    }
    validateBeatMedia(beat);
    visualClock = beat.globalEndMs;
  }
  if (visualClock !== render.totalDurationMs) {
    throw new Error("Visual timeline does not match the project duration.");
  }
}

function validateBeatMedia(beat: ClaimedProjectRenderBeat): void {
  if (beat.mediaType !== "IMAGE" && beat.mediaType !== "VIDEO") {
    throw new Error(`Visual beat ${beat.visualBeatId} has an unsupported media type.`);
  }
  if (!Number.isFinite(beat.trimStartMs) || beat.trimStartMs < 0) {
    throw new Error(`Visual beat ${beat.visualBeatId} has an invalid trim start.`);
  }
  if (beat.sourceDurationMs != null && beat.sourceDurationMs <= 0) {
    throw new Error(`Visual beat ${beat.visualBeatId} has an invalid source duration.`);
  }

  if (beat.mediaType === "IMAGE") {
    if (beat.fitMode !== "TRIM" || beat.trimStartMs !== 0) {
      throw new Error(`Image beat ${beat.visualBeatId} cannot use video fit controls.`);
    }
    return;
  }

  if (!VIDEO_FIT_MODES.has(beat.fitMode)) {
    throw new Error(`Video beat ${beat.visualBeatId} has an unsupported fit mode.`);
  }
  if (beat.sourceDurationMs != null && beat.trimStartMs >= beat.sourceDurationMs) {
    throw new Error(`Video beat ${beat.visualBeatId} starts after the source video ends.`);
  }
  const remainingMs =
    beat.sourceDurationMs == null ? null : beat.sourceDurationMs - beat.trimStartMs;
  if (beat.fitMode === "TRIM" && remainingMs != null && remainingMs < beat.durationMs) {
    throw new Error(
      `Video beat ${beat.visualBeatId} is shorter than its narration span in Trim mode.`,
    );
  }
  if (beat.fitMode === "SPEED_ADJUST" && beat.sourceDurationMs == null) {
    throw new Error(`Video beat ${beat.visualBeatId} needs a known duration for Speed Adjust.`);
  }
}

function canonicalize(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonicalize(item)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object") {
    Object.freeze(value);
    for (const child of Object.values(value as Record<string, unknown>)) {
      deepFreeze(child);
    }
  }
  return value;
}
