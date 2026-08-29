import test from "node:test";
import assert from "node:assert/strict";
import { buildMuxNarrationArgs } from "../src/main/rendering/audio-muxer.ts";

test("final mux includes subtitle track when an SRT path is provided", () => {
  const args = buildMuxNarrationArgs("video.mp4", "audio.m4a", "subtitles.srt", "final.mp4");
  assert.deepEqual(args, [
    "-i", "video.mp4",
    "-i", "audio.m4a",
    "-i", "subtitles.srt",
    "-map", "0:v:0",
    "-map", "1:a:0",
    "-map", "2:s:0",
    "-c:v", "copy",
    "-c:a", "aac",
    "-c:s", "mov_text",
    "-metadata:s:s:0", "language=und",
    "-shortest",
    "-y", "final.mp4",
  ]);
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
