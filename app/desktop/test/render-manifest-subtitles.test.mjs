import assert from "node:assert/strict";
import test from "node:test";
import { parseRenderProfile } from "../src/main/rendering/render-profile.ts";

test("render profile defaults subtitles to burn-in and accepts explicit none", () => {
  assert.deepEqual(parseRenderProfile("{}"), {
    fps: 30,
    subtitleMode: "burn_in",
  });
  assert.deepEqual(
    parseRenderProfile('{"fps":24,"subtitles":{"mode":"none"}}'),
    {
      fps: 24,
      subtitleMode: "none",
    },
  );
  assert.deepEqual(parseRenderProfile("not-json"), {
    fps: 30,
    subtitleMode: "burn_in",
  });
});
