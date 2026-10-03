import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseRenderProfile } from "../src/main/rendering/render-profile.ts";
import { buildBeatRenderArgs } from "../src/main/rendering/segment-renderer.ts";

function profile(fps) {
  return JSON.stringify({
    schemaVersion: 3,
    fps,
    watermark: { mode: "none", policyVersion: 1 },
  });
}

for (const fps of [24, 30, 60]) {
  test(`render profile preserves ${fps} FPS`, () => {
    assert.equal(parseRenderProfile(profile(fps)).fps, fps);
  });
}

for (const fps of [undefined, null, 15, 25, "24", 29.97]) {
  test(`render profile rejects unsupported FPS ${String(fps)}`, () => {
    assert.throws(() => parseRenderProfile(profile(fps)), /frame rate/i);
  });
}

test("24 FPS profile produces a 720p H.264 segment with 24 decoded frames", async () => {
  const executable = process.platform === "win32" ? ".exe" : "";
  const ffmpeg = fileURLToPath(new URL(`../resources/ffmpeg/ffmpeg${executable}`, import.meta.url));
  const ffprobe = fileURLToPath(new URL(`../resources/ffmpeg/ffprobe${executable}`, import.meta.url));
  const directory = await mkdtemp(join(tmpdir(), "narrativex-fps-"));
  try {
    const input = join(directory, "still.ppm");
    const output = join(directory, "24fps.mp4");
    await writeFile(input, Buffer.concat([
      Buffer.from("P6\n16 16\n255\n"), Buffer.alloc(16 * 16 * 3, 80),
    ]));
    const parsed = parseRenderProfile(profile(24));
    const manifest = {
      width: 1280, height: 720, fps: parsed.fps,
      videoQuality: parsed.video, colorMode: parsed.colorMode, watermark: parsed.watermark,
    };
    const beat = {
      visualBeatId: "fps-fixture", mediaType: "IMAGE", localPath: input, frameCount: 24,
      cameraMovement: "NONE", transitionInMs: 0, transitionOutMs: 0,
    };
    const encoded = spawnSync(ffmpeg, buildBeatRenderArgs(manifest, beat, output, "libx264"), {
      encoding: "utf8", windowsHide: true,
    });
    assert.equal(encoded.status, 0, encoded.error?.message ?? encoded.stderr);
    const probed = spawnSync(ffprobe, [
      "-v", "error", "-count_frames", "-select_streams", "v:0", "-show_entries",
      "stream=width,height,codec_name,r_frame_rate,avg_frame_rate,nb_read_frames", "-of", "json", output,
    ], { encoding: "utf8", windowsHide: true });
    assert.equal(probed.status, 0, probed.error?.message ?? probed.stderr);
    const stream = JSON.parse(probed.stdout).streams[0];
    assert.equal(stream.codec_name, "h264");
    assert.equal(stream.width, 1280);
    assert.equal(stream.height, 720);
    assert.equal(stream.r_frame_rate, "24/1");
    assert.equal(stream.avg_frame_rate, "24/1");
    assert.equal(stream.nb_read_frames, "24");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
