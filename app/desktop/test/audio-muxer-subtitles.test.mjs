import test from "node:test";
import assert from "node:assert/strict";
import {
  buildMuxNarrationArgs,
  escapeSubtitleFilterPath,
} from "../src/main/rendering/audio-muxer.ts";

test("final mux burns subtitles into video when an SRT path is provided", () => {
  const args = buildMuxNarrationArgs("video.mp4", "audio.m4a", "subtitles.srt", "final.mp4");
  assert.deepEqual(args, [
    "-i", "video.mp4",
    "-i", "audio.m4a",
    "-vf", "subtitles=filename='subtitles.srt'",
    "-map", "0:v:0",
    "-map", "1:a:0",
    "-c:v", "libx264",
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
  const args = buildMuxNarrationArgs("video.mp4", "audio.m4a", null, "final.mp4");
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
