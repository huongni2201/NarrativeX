import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { buildBeatRenderArgs } from "../src/main/rendering/segment-renderer.ts";
import { V2_VIDEO_QUALITY } from "../src/shared/video-encoding.ts";

function executableAvailable(name) {
  const result = spawnSync(name, ["-version"], { stdio: "ignore" });
  return !result.error && result.status === 0;
}

function run(name, args, options = {}) {
  const result = spawnSync(name, args, {
    encoding: options.encoding ?? "utf8",
    maxBuffer: 128 * 1024 * 1024,
    ...options,
  });
  assert.equal(
    result.status,
    0,
    `${name} failed\nstdout: ${String(result.stdout ?? "")}\nstderr: ${String(result.stderr ?? "")}`,
  );
  return result;
}

async function writeEdgePpm(path, width, height) {
  const header = Buffer.from(`P6\n${width} ${height}\n255\n`, "ascii");
  const pixels = Buffer.alloc(width * height * 3);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const value = x < width / 2 ? 20 : 235;
      const offset = (y * width + x) * 3;
      pixels[offset] = value;
      pixels[offset + 1] = value;
      pixels[offset + 2] = value;
    }
  }
  await writeFile(path, Buffer.concat([header, pixels]));
}

function edgeCentroid(raw, frameIndex, width, height) {
  const frameSize = width * height;
  const rowOffset = frameIndex * frameSize + Math.floor(height / 2) * width;
  let weighted = 0;
  let total = 0;
  for (let x = 1; x < width; x += 1) {
    const gradient = Math.abs(raw[rowOffset + x] - raw[rowOffset + x - 1]);
    if (gradient < 2) continue;
    const position = x - 0.5;
    weighted += position * gradient;
    total += gradient;
  }
  assert.ok(total > 0, `frame ${frameIndex} must contain a measurable vertical edge`);
  return weighted / total;
}

test("v3 moving still produces 60 decoded CFR frames with smooth monotonic subpixel motion", async (t) => {
  if (!executableAvailable("ffmpeg") || !executableAvailable("ffprobe")) {
    t.skip("ffmpeg/ffprobe are required for the render integration fixture");
    return;
  }

  const directory = await mkdtemp(join(tmpdir(), "narrativex-motion-"));
  try {
    const input = join(directory, "edge.ppm");
    const output = join(directory, "motion.mp4");
    await writeEdgePpm(input, 640, 360);

    const manifest = {
      width: 320,
      height: 180,
      fps: 60,
      videoEncoder: "libx264",
      videoQuality: V2_VIDEO_QUALITY,
      colorMode: "SDR_BT709_LIMITED",
    };
    const beat = {
      visualBeatId: "fixture-beat",
      mediaType: "IMAGE",
      localPath: input,
      frameCount: 60,
      cameraMovement: "PAN",
      transitionInMs: 0,
      transitionOutMs: 0,
    };

    const args = buildBeatRenderArgs(manifest, beat, output, "libx264");
    run("ffmpeg", ["-hide_banner", "-loglevel", "error", ...args]);

    const probe = JSON.parse(
      run(
        "ffprobe",
        [
          "-v", "error",
          "-count_frames",
          "-select_streams", "v:0",
          "-show_entries", "stream=width,height,r_frame_rate,avg_frame_rate,nb_read_frames,color_space,color_primaries,color_transfer,color_range",
          "-of", "json",
          output,
        ],
      ).stdout,
    );
    const stream = probe.streams?.[0];
    assert.equal(stream.width, 320);
    assert.equal(stream.height, 180);
    assert.equal(stream.nb_read_frames, "60");
    assert.equal(stream.r_frame_rate, "60/1");
    assert.equal(stream.avg_frame_rate, "60/1");
    assert.equal(stream.color_space, "bt709");
    assert.equal(stream.color_primaries, "bt709");
    assert.equal(stream.color_transfer, "bt709");
    assert.equal(stream.color_range, "tv");

    const rawPath = join(directory, "decoded.gray");
    run("ffmpeg", [
      "-hide_banner", "-loglevel", "error",
      "-i", output,
      "-f", "rawvideo",
      "-pix_fmt", "gray",
      "-y", rawPath,
    ]);
    const raw = await readFile(rawPath);
    const frameSize = 320 * 180;
    assert.equal(raw.length, frameSize * 60);

    const positions = Array.from({ length: 60 }, (_, index) => edgeCentroid(raw, index, 320, 180));
    const direction = Math.sign(positions.at(-1) - positions[0]);
    assert.notEqual(direction, 0, "PAN must move the measured edge");
    const deltas = positions.slice(1).map((position, index) => (position - positions[index]) * direction);
    assert.ok(
      deltas.every((delta) => delta >= -0.15),
      `motion must not jump backwards: ${JSON.stringify(deltas)}`,
    );
    assert.ok(
      Math.max(...deltas) <= 0.8,
      `no decoded frame may jump more than 0.8 target pixel: max=${Math.max(...deltas)}`,
    );
    const uniqueSubpixelPositions = new Set(positions.map((position) => position.toFixed(2))).size;
    assert.ok(
      uniqueSubpixelPositions >= 30,
      `expected subpixel progression across at least 30 distinct decoded positions, got ${uniqueSubpixelPositions}`,
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
