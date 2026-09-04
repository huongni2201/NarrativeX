import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import test from "node:test";

const desktopRoot = resolve(dirname(import.meta.filename), "..");

function source(path) {
  return readFileSync(join(desktopRoot, path), "utf8");
}

test("FFmpeg runtime probes NVENC and retains a libx264 fallback", () => {
  const runtime = source("src/main/rendering/ffmpeg-runtime.ts");
  const encoder = source("src/main/rendering/video-encoder.ts");
  assert.match(runtime, /resolveVideoEncoder\(/);
  assert.match(runtime, /shouldDisableHardwareAcceleration/);
  assert.match(encoder, /h264_nvenc/);
  assert.match(encoder, /probe\.exitCode === 0 \? "h264_nvenc" : "libx264"/);
  assert.match(encoder, /MAX_RENDER_CONCURRENCY = 4/);
});

test("project renderer selects an encoder and workload concurrency for segment rendering", () => {
  const renderer = source("src/main/rendering/project-renderer.ts");
  assert.match(renderer, /const videoEncoder = await resolveVideoEncoderForProfile\(/);
  assert.match(renderer, /concurrency:\s*renderConcurrency/);
});

test("project renderer keeps final mux on the encoded video and narration", () => {
  const renderer = source("src/main/rendering/project-renderer.ts");
  assert.match(renderer, /muxNarration\([\s\S]*?video,[\s\S]*?audio,[\s\S]*?signal,\s*\)/);
  assert.doesNotMatch(renderer, /subtitlePath/);
});

test("segment renderer uses a bounded worker pool and encoder-aware cache", () => {
  const renderer = source("src/main/rendering/segment-renderer.ts");
  assert.match(renderer, /Promise\.all\(Array\.from\(\{ length: concurrency \}, \(\) => worker\(\)\)\)/);
  assert.match(renderer, /segmentCacheKey\(manifest, beat, videoEncoder\)/);
  assert.match(renderer, /rendererVersion:\s*manifest\.rendererVersion/);
  assert.match(renderer, /failureController\.abort/);
});

test("audio muxer uses stream-copy arguments for already encoded inputs", () => {
  const muxer = source("src/main/rendering/audio-muxer.ts");
  assert.match(muxer, /buildMuxNarrationArgs\(videoPath,\s*audioPath,\s*output\)/);
  const args = source("src/shared/audio-muxer-args.ts");
  assert.match(args, /"-c:v",\s*"copy"/);
  assert.match(args, /"-c:a",\s*"copy"/);
});
