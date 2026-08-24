import { createHash } from "node:crypto";
import type {
  ClaimedProjectRender,
  ClaimedProjectRenderBeat,
  ClaimedProjectRenderChapter,
} from "../local-execution/backend-client";

const SHA256_PATTERN = /^[0-9a-f]{64}$/i;

export interface LocalRenderManifest {
  readonly version: 1;
  readonly jobId: string;
  readonly projectId: string;
  readonly renderFingerprint: string;
  readonly width: number;
  readonly height: number;
  readonly fps: number;
  readonly beats: readonly LocalRenderBeat[];
  readonly audio: { readonly chapters: readonly LocalRenderAudio[] };
  readonly subtitles: readonly [];
  readonly effects: Record<string, never>;
  readonly output: { readonly format: "mp4"; readonly mimeType: "video/mp4" };
}

export interface LocalRenderBeat
  extends Omit<ClaimedProjectRenderBeat, "localPath"> {
  readonly localPath: string;
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
): LocalRenderManifest {
  const { width, height } = renderDimensions(render.resolution, render.aspectRatio);
  const fps = parseFps(render.renderProfileJson);
  validateTimeline(render);

  const beats = render.beats.map(({ localPath, ...beat }) => ({ ...beat, localPath }));
  const audio = {
    chapters: render.chapters.map(({ localPath, ...chapter }) => ({
      ...chapter,
      localPath,
    })),
  };
  const fingerprintSource = canonicalize({
    version: 1,
    jobId: render.jobId,
    projectId: render.projectId,
    width,
    height,
    fps,
    beats: beats.map(({ localPath: _path, ...beat }) => beat),
    audio: {
      chapters: audio.chapters.map(({ localPath: _path, ...chapter }) => chapter),
    },
    output: { format: "mp4" },
  });

  return deepFreeze({
    version: 1 as const,
    jobId: render.jobId,
    projectId: render.projectId,
    renderFingerprint: createHash("sha256").update(fingerprintSource).digest("hex"),
    width,
    height,
    fps,
    beats,
    audio,
    subtitles: [] as const,
    effects: {} as Record<string, never>,
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

function parseFps(renderProfileJson: string): number {
  try {
    const profile = JSON.parse(renderProfileJson) as { fps?: unknown };
    return typeof profile.fps === "number" && profile.fps > 0 ? profile.fps : 30;
  } catch {
    return 30;
  }
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
    visualClock = beat.globalEndMs;
  }
  if (visualClock !== render.totalDurationMs) {
    throw new Error("Visual timeline does not match the project duration.");
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
