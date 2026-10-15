import assert from "node:assert/strict";
import test from "node:test";
import {
  renderConcurrencyForEncoder,
  renderConcurrencyForWorkload,
  resolveVideoEncoderForProfile,
} from "../src/main/rendering/video-encoder.ts";
import { V2_VIDEO_QUALITY } from "../src/shared/video-encoding.ts";

test("software-only renders use libx264", async () => {
  const encoder = await resolveVideoEncoderForProfile(
    process.execPath,
    false,
    V2_VIDEO_QUALITY,
    1280,
    720,
  );

  assert.equal(encoder, "libx264");
});

test("a failed NVENC probe falls back to libx264", async () => {
  const encoder = await resolveVideoEncoderForProfile(
    process.execPath,
    true,
    V2_VIDEO_QUALITY,
    1280,
    720,
  );

  assert.equal(encoder, "libx264");
});

test("encoder concurrency defaults and environment overrides are bounded", () => {
  assert.equal(renderConcurrencyForEncoder("h264_nvenc", {}), 3);
  assert.equal(renderConcurrencyForEncoder("libx264", {}), 2);
  assert.equal(
    renderConcurrencyForEncoder("libx264", { NARRATIVEX_RENDER_CONCURRENCY: "3" }),
    3,
  );
  assert.equal(
    renderConcurrencyForEncoder("h264_nvenc", { NARRATIVEX_RENDER_CONCURRENCY: "99" }),
    4,
  );
  assert.equal(
    renderConcurrencyForEncoder("h264_nvenc", { NARRATIVEX_RENDER_CONCURRENCY: "0" }),
    3,
  );
});

test("4K moving-still workloads cap concurrent renders by frame rate", () => {
  assert.equal(renderConcurrencyForWorkload("h264_nvenc", 3840, 2160, 30, true, {}), 2);
  assert.equal(renderConcurrencyForWorkload("h264_nvenc", 3840, 2160, 60, true, {}), 1);
  assert.equal(renderConcurrencyForWorkload("h264_nvenc", 3840, 2160, 60, false, {}), 3);
  assert.equal(renderConcurrencyForWorkload("h264_nvenc", 1920, 1080, 60, true, {}), 3);
});
