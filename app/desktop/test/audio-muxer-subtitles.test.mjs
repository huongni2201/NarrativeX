import test from "node:test";
import assert from "node:assert/strict";
import { buildMuxNarrationArgs } from "../src/shared/audio-muxer-args.ts";

test("final mux stream-copies encoded video and narration", () => {
  const args = buildMuxNarrationArgs("video.mp4", "audio.m4a", "final.mp4");
  assert.deepEqual(args, [
    "-i", "video.mp4",
    "-i", "audio.m4a",
    "-map", "0:v:0",
    "-map", "1:a:0",
    "-c:v", "copy",
    "-c:a", "copy",
    "-shortest",
    "-y", "final.mp4",
  ]);
});
