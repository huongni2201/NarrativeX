import { createHash } from "node:crypto";
import type { ClaimedProjectRender, ClaimedProjectRenderBeat, ClaimedProjectRenderChapter } from "../local-execution/backend-client";

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

export interface LocalRenderBeat extends Omit<ClaimedProjectRenderBeat, "localPath"> {
  readonly localPath: string;
}

export interface LocalRenderAudio extends Omit<ClaimedProjectRenderChapter, "localPath"> {
  readonly localPath: string;
}

export function buildLocalRenderManifest(render: ClaimedProjectRender & { chapters: Array<ClaimedProjectRenderChapter & { localPath: string }>; beats: Array<ClaimedProjectRenderBeat & { localPath: string }> }): LocalRenderManifest {
  const { width, height } = parseResolution(render.resolution);
  const fps = parseFps(render.renderProfileJson);
  validateTimeline(render);
  const beats = render.beats.map(({ localPath, ...beat }) => ({ ...beat, localPath }));
  const audio = { chapters: render.chapters.map(({ localPath, ...chapter }) => ({ ...chapter, localPath })) };
  const fingerprintSource = canonicalize({ version: 1, jobId: render.jobId, projectId: render.projectId, width, height, fps, beats: beats.map(({ localPath: _path, ...beat }) => beat), audio: { chapters: audio.chapters.map(({ localPath: _path, ...chapter }) => chapter) }, output: { format: "mp4" } });
  const manifest = { version: 1 as const, jobId: render.jobId, projectId: render.projectId, renderFingerprint: createHash("sha256").update(fingerprintSource).digest("hex"), width, height, fps, beats, audio, subtitles: [] as const, effects: {} as Record<string, never>, output: { format: "mp4" as const, mimeType: "video/mp4" as const } };
  return deepFreeze(manifest);
}

function parseResolution(value: string): { width: number; height: number } {
  const match = value.match(/^(\d+)x(\d+)$/i);
  if (match) return { width: Number(match[1]), height: Number(match[2]) };
  const heights: Record<string, number> = { "720p": 720, "1080p": 1080, "1440p": 1440, "2160p": 2160 };
  const height = heights[value.toLowerCase()];
  if (!height) throw new Error(`Unsupported render resolution: ${value}`);
  return { width: Math.round(height * 16 / 9), height };
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
  for (const chapter of render.chapters) if (chapter.globalEndMs <= chapter.globalStartMs || !chapter.narrationAssetId) throw new Error(`Invalid narration chapter ${chapter.chapterId}.`);
  const beats = [...render.beats].sort((a, b) => a.globalStartMs - b.globalStartMs || a.beatIndex - b.beatIndex);
  for (let index = 0; index < beats.length; index += 1) {
    const beat = beats[index];
    if (beat.globalEndMs <= beat.globalStartMs || beat.durationMs <= 0 || !beat.mediaAssetId) throw new Error(`Invalid visual beat ${beat.visualBeatId}.`);
    if (index > 0 && beats[index - 1].globalEndMs > beat.globalStartMs) throw new Error(`Overlapping visual beats around ${beat.visualBeatId}.`);
  }
}

function canonicalize(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${canonicalize(item)}`).join(",")}}`;
  return JSON.stringify(value);
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object") { Object.freeze(value); for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child); }
  return value;
}
