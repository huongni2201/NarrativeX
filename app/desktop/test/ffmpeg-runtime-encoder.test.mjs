import assert from "node:assert/strict";
import { chmod, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { resolveFfmpegRuntime } from "../src/main/rendering/ffmpeg-runtime.ts";
import { renderConcurrencyForEncoder } from "../src/main/rendering/video-encoder.ts";

async function fakeRuntime(directory) {
  const path = join(directory, "fake-ffmpeg.sh");
  await writeFile(
    path,
    `#!/bin/sh\ncase "$*" in\n  *-version*) echo 'ffmpeg version fake'; exit 0 ;;\n  *h264_nvenc*) exit "\${FAKE_NVENC_EXIT:-0}" ;;\n  *) exit 0 ;;\nesac\n`,
    "utf8",
  );
  await chmod(path, 0o755);
  return path;
}

async function withRuntimeEnv(values, action) {
  const keys = Object.keys(values);
  const previous = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  try {
    return await action();
  } finally {
    for (const key of keys) {
      const value = previous[key];
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

test("runtime selects NVENC after a real encoder probe succeeds", { skip: process.platform === "win32" }, async () => {
  const root = await mkdtemp(join(tmpdir(), "nx-runtime-nvenc-"));
  const executable = await fakeRuntime(root);
  const status = await withRuntimeEnv(
    {
      NARRATIVEX_FFMPEG_PATH: executable,
      NARRATIVEX_FFPROBE_PATH: executable,
      NARRATIVEX_DISABLE_GPU: undefined,
      FAKE_NVENC_EXIT: "0",
    },
    () => resolveFfmpegRuntime(),
  );
  assert.equal(status.videoEncoder, "h264_nvenc");
  assert.equal(status.renderConcurrency, 3);
});

test("runtime falls back to libx264 when NVENC cannot encode", { skip: process.platform === "win32" }, async () => {
  const root = await mkdtemp(join(tmpdir(), "nx-runtime-cpu-"));
  const executable = await fakeRuntime(root);
  const status = await withRuntimeEnv(
    {
      NARRATIVEX_FFMPEG_PATH: executable,
      NARRATIVEX_FFPROBE_PATH: executable,
      NARRATIVEX_DISABLE_GPU: undefined,
      FAKE_NVENC_EXIT: "1",
    },
    () => resolveFfmpegRuntime(),
  );
  assert.equal(status.videoEncoder, "libx264");
  assert.equal(status.renderConcurrency, 2);
});

test("runtime respects explicit GPU disable and stays on CPU", { skip: process.platform === "win32" }, async () => {
  const root = await mkdtemp(join(tmpdir(), "nx-runtime-disabled-"));
  const executable = await fakeRuntime(root);
  const status = await withRuntimeEnv(
    {
      NARRATIVEX_FFMPEG_PATH: executable,
      NARRATIVEX_FFPROBE_PATH: executable,
      NARRATIVEX_DISABLE_GPU: "true",
      FAKE_NVENC_EXIT: "0",
    },
    () => resolveFfmpegRuntime(),
  );
  assert.equal(status.videoEncoder, "libx264");
});

test("render concurrency override is capped", () => {
  assert.equal(
    renderConcurrencyForEncoder("h264_nvenc", { NARRATIVEX_RENDER_CONCURRENCY: "99" }),
    4,
  );
  assert.equal(
    renderConcurrencyForEncoder("libx264", { NARRATIVEX_RENDER_CONCURRENCY: "1" }),
    1,
  );
});
