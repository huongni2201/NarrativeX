import assert from "node:assert/strict";
import test from "node:test";
import { buildAssTrack } from "../src/main/rendering/subtitle-ass.ts";
import { parseRenderProfile } from "../src/main/rendering/render-profile.ts";
import { segmentCacheKey } from "../src/main/rendering/segment-cache-key.ts";

const style = {
  version: 2, position: "TOP_LEFT", preset: "OUTLINE", fontFamily: "Verdana",
  fontWeight: 700, fontSizeRatio: 0.05, edgeMarginRatio: 0.08,
  primaryColor: "#FFCC00", outlineColor: "#123456", backgroundColor: "#000000",
  backgroundOpacity: 0.4,
};
const raw = (subtitleStyle) => JSON.stringify({ schemaVersion: 4, audioMode: "NATIVE_TAKE", fps: 24,
  subtitles: { mode: "burn_in", ...(subtitleStyle ? { style: subtitleStyle } : {}) },
  watermark: { mode: "none", policyVersion: 1 } });

test("render profile retains selected styling and gives old snapshots the original appearance", () => {
  assert.deepEqual(parseRenderProfile(raw(style)).subtitleStyle, style);
  assert.equal(parseRenderProfile(raw()).subtitleStyle, undefined);
  assert.match(buildAssTrack([], 1280, 720), /Style: Default,Arial,24,&H00FFFFFF&,&H00FFFFFF&,&H00000000&,&H40000000&,-1,0,0,0,100,100,0,0,3,1,1,2,102,102,50,1/);
});

test("untrusted subtitle styles cannot inject ASS styles or use out-of-range values", () => {
  for (const patch of [{fontFamily: "Arial,80\nStyle: injected"}, {position: "ANY"},
    {preset: "KARAOKE"}, {fontSizeRatio: 1}, {edgeMarginRatio: -1},
    {primaryColor: "red}"}, {backgroundOpacity: 2}, {fontWeight: 999}, {version: 99}]) {
    assert.throws(() => parseRenderProfile(raw({...style, ...patch})), /subtitle style/i);
  }
});

test("ASS export uses the chosen font, scaled size, colors, alignment and safe margins", () => {
  const track = buildAssTrack([{startMs: 0, endMs: 1000, text: "Tiếng Việt: Đường về nhà"}], 1280, 720, style);
  const fields = track.split("\n").find((line) => line.startsWith("Style: Default,")).split(",");
  assert.equal(fields[1], "Verdana");
  assert.equal(fields[2], "36");
  assert.equal(fields[3], "&H0000CCFF&");
  assert.equal(fields[5], "&H00563412&");
  assert.equal(fields[15], "1"); // outline, rather than an opaque ASS box
  assert.equal(fields[18], "7"); // ASS top-left anchor
  assert.equal(fields[19], "102");
  assert.equal(fields[21], "58");
  assert.match(track, /Tiếng Việt: Đường về nhà/);
});

test("all nine positions map to the correct ASS anchor", () => {
  const positions = ["BOTTOM_LEFT", "BOTTOM_CENTER", "BOTTOM_RIGHT", "MIDDLE_LEFT", "MIDDLE_CENTER",
    "MIDDLE_RIGHT", "TOP_LEFT", "TOP_CENTER", "TOP_RIGHT"];
  positions.forEach((position, index) => {
    const track = buildAssTrack([], 1280, 720, {...style, position});
    const fields = track.split("\n").find((line) => line.startsWith("Style: Default,")).split(",");
    assert.equal(fields[18], String(index + 1), position);
  });
});

test("changing subtitle appearance invalidates a segment cache with visible captions", () => {
  const profile = parseRenderProfile(raw());
  const beat = { mediaType: "VIDEO", checksum: "a".repeat(64), durationMs: 1000,
    startFrame: 0, endFrame: 24, frameCount: 24, cameraMovement: "NONE" };
  const manifest = { width: 1280, height: 720, fps: 24, videoQuality: profile.video,
    subtitles: [{ startMs: 0, endMs: 900, text: "Hello" }], subtitleStyle: style };
  const original = segmentCacheKey(manifest, beat, "libx264");
  for (const patch of [{position: "TOP_RIGHT"}, {fontFamily: "Georgia"}, {preset: "BACKGROUND"},
    {fontSizeRatio: 0.04}, {edgeMarginRatio: 0.1}, {primaryColor: "#FFFFFF"}, {fontWeight: 400},
    {outlineColor: "#FFFFFF"}, {backgroundOpacity: 0.8}]) {
    assert.notEqual(segmentCacheKey({...manifest, subtitleStyle: {...style, ...patch}}, beat, "libx264"), original);
  }
});
