import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { mkdtemp, mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { renderSegments } from "../src/main/rendering/segment-renderer.ts";
import { segmentCacheKey } from "../src/main/rendering/segment-cache-key.ts";
import { parseRenderProfile } from "../src/main/rendering/render-profile.ts";
import { publishCachedSegment, validateCachedSegment } from "../src/main/rendering/segment-cache.ts";

const suffix = process.platform === "win32" ? ".exe" : "";
const ffmpeg = fileURLToPath(new URL(`../resources/ffmpeg/ffmpeg${suffix}`, import.meta.url));
const ffprobe = fileURLToPath(new URL(`../resources/ffmpeg/ffprobe${suffix}`, import.meta.url));

test("nonempty corrupt cache is rebuilt, valid hit survives restart, tampering rebuilds", async () => {
  const directory = await mkdtemp(join(tmpdir(), "narrativex-cache-"));
  try {
    const input = join(directory, "still.ppm");
    await writeFile(input, Buffer.concat([Buffer.from("P6\n16 16\n255\n"), Buffer.alloc(768, 80)]));
    const profile = parseRenderProfile(JSON.stringify({ schemaVersion: 3, fps: 24, watermark: { mode: "none", policyVersion: 1 } }));
    const beat = { visualBeatId: "cache-fixture", mediaType: "IMAGE", localPath: input,
      frameCount: 24, cameraMovement: "NONE", transitionInMs: 0, transitionOutMs: 0,
      checksum: "a".repeat(64), durationMs: 1000, trimStartMs: 0, fitMode: "TRIM", globalStartMs: 0, globalEndMs: 1000 };
    const manifest = { width: 32, height: 32, fps: 24, videoEncoder: "libx264", rendererVersion: profile.rendererVersion,
      renderProfileSchemaVersion: 3, compositionPolicyVersion: 1, videoQuality: profile.video,
      colorMode: profile.colorMode, watermark: profile.watermark, beats: [beat], subtitles: [] };
    const cache = join(directory, "cache");
    await mkdir(cache);
    const key = segmentCacheKey(manifest, beat, "libx264", "fixture-ffmpeg");
    const cached = join(cache, `${key}.mp4`);
    await writeFile(cached, "nonempty corrupt MP4");
    const options = { ffprobePath: ffprobe, ffmpegVersion: "fixture-ffmpeg" };
    const render = () => renderSegments(ffmpeg, join(directory, "work"), manifest, new AbortController().signal, cache, options);
    const [first] = await render();
    const probed = spawnSync(ffprobe, ["-v", "error", "-show_streams", first], { encoding: "utf8", windowsHide: true });
    assert.equal(probed.status, 0, probed.stderr);
    const verifiedBytes = await readFile(first);
    // A valid cache must avoid FFmpeg entirely, even when its executable is unavailable.
    await renderSegments("missing-ffmpeg", join(directory, "restart"), manifest, new AbortController().signal, cache, options);
    await writeFile(cached, "tampered bytes");
    await render();
    assert.deepEqual(await readFile(cached), verifiedBytes);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("sidecar, checksum, dimensions, frame count and audio policy are all required", async () => {
  const directory = await mkdtemp(join(tmpdir(), "narrativex-cache-metadata-"));
  try {
    const source = join(directory, "source.mp4");
    const encoded = spawnSync(ffmpeg, ["-f", "lavfi", "-i", "color=blue:s=32x32:r=24:d=1",
      "-an", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-y", source], { encoding: "utf8", windowsHide: true });
    assert.equal(encoded.status, 0, encoded.stderr);
    const cached = join(directory, "cached.mp4");
    const expected = { cacheKey: "key", width: 32, height: 32, fps: 24, frameCount: 24, requiresAudio: false };
    await publishCachedSegment(ffprobe, source, cached, expected);
    assert.equal(await validateCachedSegment(ffprobe, cached, expected), true);
    const valid = JSON.parse(await readFile(`${cached}.json`, "utf8"));
    for (const change of [{ version: 0 }, { cacheKey: "other" }, { sizeBytes: 1 }, { sha256: "f".repeat(64) }]) {
      await writeFile(`${cached}.json`, JSON.stringify({ ...valid, ...change }));
      assert.equal(await validateCachedSegment(ffprobe, cached, expected), false);
    }
    for (const change of [{ fps: 30 }, { frameCount: 25 }, { width: 64 }, { requiresAudio: true }]) {
      await writeFile(`${cached}.json`, JSON.stringify({ ...valid, ...change }));
      assert.equal(await validateCachedSegment(ffprobe, cached, { ...expected, ...change }), false);
    }
    await writeFile(`${cached}.json`, "{incomplete");
    assert.equal(await validateCachedSegment(ffprobe, cached, expected), false);
    await rm(`${cached}.json`);
    assert.equal(await validateCachedSegment(ffprobe, cached, expected), false);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
