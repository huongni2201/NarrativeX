import { randomUUID } from "node:crypto";
import { copyFile, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { isMissingFile, sha256File } from "../local-storage/file-integrity.ts";
import { sharedIntegrityCache } from "../local-storage/integrity-cache.ts";
import { runProcess } from "./process-runner.ts";

export interface CachedSegmentExpectation {
  cacheKey: string;
  width: number;
  height: number;
  fps: number;
  frameCount: number;
  requiresAudio: boolean;
}

interface SegmentMetadata extends CachedSegmentExpectation {
  version: 1;
  sha256: string;
  sizeBytes: number;
}

/** A sidecar is the publication marker; legacy or incomplete entries are misses. */
export async function validateCachedSegment(
  ffprobePath: string,
  path: string,
  expected: CachedSegmentExpectation,
): Promise<boolean> {
  try {
    const file = await stat(path);
    if (!file.isFile() || file.size <= 0) return false;
    let metadata: SegmentMetadata;
    const sidecar = await readFile(`${path}.json`, "utf8");
    try {
      metadata = JSON.parse(sidecar) as SegmentMetadata;
    } catch {
      return false;
    }
    if (!metadata || metadata.version !== 1 || metadata.sizeBytes !== file.size ||
        !/^[a-f0-9]{64}$/i.test(metadata.sha256) ||
        Object.entries(expected).some(([key, value]) => metadata[key as keyof SegmentMetadata] !== value)) {
      return false;
    }
    // Reuse trusts a previous hash while size, mtime and inode are unchanged (fast mode).
    if (!(await sharedIntegrityCache.verifyFile(path, metadata.sha256, "fast"))) return false;
    return await matchesStreams(ffprobePath, path, expected);
  } catch (error) {
    if (isMissingFile(error)) return false;
    throw error;
  }
}

export async function evictCachedSegment(path: string): Promise<void> {
  await rm(`${path}.json`, { force: true });
  await rm(path, { force: true });
}

export async function publishCachedSegment(
  ffprobePath: string,
  source: string,
  path: string,
  expected: CachedSegmentExpectation,
): Promise<void> {
  const temporary = `${path}.${randomUUID()}.tmp`;
  const sidecar = `${temporary}.json`;
  try {
    await copyFile(source, temporary);
    if (!await matchesStreams(ffprobePath, temporary, expected)) {
      throw new Error("Encoded segment does not match its frozen render profile.");
    }
    const metadata: SegmentMetadata = {
      ...expected, version: 1, sha256: await sha256File(temporary),
      sizeBytes: (await stat(temporary)).size,
    };
    await writeFile(sidecar, JSON.stringify(metadata));
    await rename(temporary, path);
    await rename(sidecar, `${path}.json`);
  } finally {
    await rm(temporary, { force: true });
    await rm(sidecar, { force: true });
  }
}

async function matchesStreams(
  ffprobePath: string, path: string, expected: CachedSegmentExpectation,
): Promise<boolean> {
  const result = await runProcess(ffprobePath, [
    "-v", "error", "-count_frames", "-show_streams", "-of", "json", path,
  ]).result;
  if (result.exitCode !== 0 || result.stderr.trim()) return false;
  let payload: { streams?: Array<{ codec_type?: string; width?: number; height?: number;
    avg_frame_rate?: string; nb_read_frames?: string; sample_rate?: string; channels?: number }> };
  try { payload = JSON.parse(result.stdout) as typeof payload; }
  catch { return false; }
  if (!Array.isArray(payload.streams)) return false;
  const videos = payload.streams.filter(stream => stream.codec_type === "video");
  const audio = payload.streams.filter(stream => stream.codec_type === "audio");
  if (videos.length !== 1) return false;
  const video = videos[0]!;
  const [numerator, denominator] = (video.avg_frame_rate ?? "").split("/").map(Number);
  const fps = denominator ? numerator! / denominator : NaN;
  return video.width === expected.width && video.height === expected.height &&
    Math.abs(fps - expected.fps) < 0.000001 && Number(video.nb_read_frames) === expected.frameCount &&
    (expected.requiresAudio ? audio.length === 1 && Number(audio[0]!.sample_rate) > 0 &&
      Number(audio[0]!.channels) > 0 : audio.length === 0);
}
