import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(
  new URL("../src/renderer/features/editor/components/EditorPreviewViewport.tsx", import.meta.url),
  "utf8",
);

test("narration play rejection activates fallback playback clock", () => {
  const playFailureHandler = source.match(/audio\.play\(\)\.catch\(\(error: unknown\) => \{([\s\S]*?)\n\s*\}\);/);
  assert.ok(playFailureHandler, "expected narration audio play rejection handler");
  assert.match(playFailureHandler[1], /setAudioFailed\(true\)/);
  assert.match(playFailureHandler[1], /onPlaybackError\(/);
});
