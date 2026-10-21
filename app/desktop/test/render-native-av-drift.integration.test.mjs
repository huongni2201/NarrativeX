import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseRenderProfile } from "../src/main/rendering/render-profile.ts";
import { buildBeatRenderArgs } from "../src/main/rendering/segment-renderer.ts";
import { concatVideo } from "../src/main/rendering/video-concat.ts";
import { validateRenderSync } from "../src/main/rendering/render-sync-validation.ts";

const profile = JSON.stringify({schemaVersion: 4, audioMode: "NATIVE_TAKE", fps: 24,
  watermark: {mode: "none", policyVersion: 1}, subtitles: {mode: "none"}});

// Cut lengths are deliberately not multiples of an AAC frame (1024 samples = 21.33 ms) so each
// segment boundary can add rounding if the audio is stream-copied.
const CUT_FRAMES = [53, 71, 62, 88, 47];

test("many native cuts keep decoded audio and video within the render sync tolerance", async () => {
  const suffix = process.platform === "win32" ? ".exe" : "";
  const ffmpeg = fileURLToPath(new URL(`../resources/ffmpeg/ffmpeg${suffix}`, import.meta.url));
  const ffprobe = fileURLToPath(new URL(`../resources/ffmpeg/ffprobe${suffix}`, import.meta.url));
  const run = (exe, args) => {
    const result = spawnSync(exe, args, {encoding: "utf8", windowsHide: true});
    assert.equal(result.status, 0, result.error?.message ?? result.stderr);
    return result.stdout;
  };
  const dir = await mkdtemp(join(tmpdir(), "nx-native-drift-"));
  try {
    const parsed = parseRenderProfile(profile);
    const manifest = {width: 1280, height: 720, fps: 24, audioMode: parsed.audioMode,
      videoQuality: parsed.video, colorMode: parsed.colorMode, watermark: parsed.watermark};
    const source = join(dir, "source.mp4");
    run(ffmpeg, ["-f", "lavfi", "-i", "color=c=gray:s=1280x720:r=24:d=6",
      "-f", "lavfi", "-i", "sine=frequency=440:sample_rate=48000:duration=6",
      "-c:v", "libx264", "-preset", "ultrafast", "-pix_fmt", "yuv420p", "-c:a", "aac", "-y", source]);
    const segments = [];
    let frames = 0;
    for (let i = 0; i < 30; i++) {
      const frameCount = CUT_FRAMES[i % CUT_FRAMES.length];
      const durationMs = Math.round((frameCount * 1000) / 24);
      const output = join(dir, `cut-${i}.mp4`);
      const beat = {visualBeatId: `beat-${i}`, shotId: `shot-${i}`, takeId: `take-${i}`,
        mediaType: "VIDEO", localPath: source, sourceDurationMs: 6000, trimStartMs: 500,
        sourceOutMs: 500 + durationMs, durationMs, fitMode: "TRIM", frameCount,
        cameraMovement: "NONE", transitionInMs: 0, transitionOutMs: 0};
      run(ffmpeg, buildBeatRenderArgs(manifest, beat, output, "libx264"));
      segments.push(output);
      frames += frameCount;
    }
    const final = await concatVideo(ffmpeg, dir, segments);
    const streams = JSON.parse(run(ffprobe, ["-v", "error", "-show_streams", "-of", "json", final])).streams;
    const video = streams.find((s) => s.codec_type === "video");
    const audio = streams.find((s) => s.codec_type === "audio");
    const expectedMs = (frames * 1000) / 24;
    const videoMs = Number(video.duration) * 1000;
    const audioMs = Number(audio.duration) * 1000;
    console.log(`expected=${expectedMs.toFixed(1)}ms video=${videoMs.toFixed(1)}ms audio=${audioMs.toFixed(1)}ms`);
    assert.doesNotThrow(() => validateRenderSync({fps: 24, width: 1280, height: 720,
      durationMs: Math.max(videoMs, audioMs), videoStartMs: Number(video.start_time) * 1000,
      videoDurationMs: videoMs, audioStartMs: Number(audio.start_time) * 1000, audioDurationMs: audioMs},
    expectedMs, 24, {width: 1280, height: 720}));
  } finally {
    await rm(dir, {recursive: true, force: true});
  }
});
