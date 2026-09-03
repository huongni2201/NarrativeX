import test from "node:test";
import assert from "node:assert/strict";
import {
  buildMuxNarrationArgs,
  escapeSubtitleFilterPath,
} from "../src/shared/audio-muxer-args.ts";

const highQuality = {
  x264Preset: "medium",
  crf: 18,
  nvencPreset: "p6",
  nvencCq: 19,
  pixelFormat: "yuv420p",
};

test("final mux burns subtitles with explicit x264 quality", () => {
  const args = buildMuxNarrationArgs(
    "video.mp4",
    "audio.m4a",
    "subtitles.srt",
    "final.mp4",
    "libx264",
    highQuality,
  );
  assert.deepEqual(args, [
    "-i", "video.mp4",
    "-i", "audio.m4a",
    "-vf", "subtitles=filename='subtitles.srt'",
    "-map", "0:v:0",
    "-map", "1:a:0",
    "-c:v", "libx264",
    "-preset", "medium",
    "-crf", "18",
    "-pix_fmt", "yuv420p",
    "-c:a", "aac",
    "-shortest",
    "-y", "final.mp4",
  ]);
});

test("subtitle filter paths are safe for Windows drive paths", () => {
  assert.equal(
    escapeSubtitleFilterPath("C:\\work folder\\subtitles.srt"),
    "C\\:/work folder/subtitles.srt",
  );
});

test("final mux stays subtitle-free when no renderable cues exist", () => {
  const args = buildMuxNarrationArgs(
    "video.mp4",
    "audio.m4a",
    null,
    "final.mp4",
    "libx264",
    highQuality,
  );
  assert.deepEqual(args, [
    "-i", "video.mp4",
    "-i", "audio.m4a",
    "-map", "0:v:0",
    "-map", "1:a:0",
    "-c:v", "copy",
    "-c:a", "aac",
    "-shortest",
    "-y", "final.mp4",
  ]);
});

test("final mux uses explicit NVENC quality when burning subtitles", () => {
  const args = buildMuxNarrationArgs(
    "video.mp4",
    "audio.m4a",
    "subtitles.srt",
    "final.mp4",
    "h264_nvenc",
    highQuality,
  );
  const encoderIndex = args.indexOf("-c:v");
  assert.equal(args[encoderIndex + 1], "h264_nvenc");
  assert.deepEqual(args.slice(encoderIndex, encoderIndex + 14), [
    "-c:v", "h264_nvenc",
    "-preset", "p6",
    "-rc", "vbr",
    "-cq", "19",
    "-b:v", "0",
    "-pix_fmt", "yuv420p",
    "-c:a", "aac",
  ]);
});
