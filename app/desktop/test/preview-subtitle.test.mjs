import test from "node:test";
import assert from "node:assert/strict";
import {
  SUBTITLE_SAMPLE_TEXT,
  resolvePreviewSubtitleText,
} from "../src/renderer/features/editor/preview-subtitle.ts";

test("subtitle preview shows nothing when subtitles are disabled, even while editing", () => {
  assert.equal(resolvePreviewSubtitleText({ enabled: false, activeText: "Xin chào", editing: true }), null);
});

test("subtitle preview prefers the real cue at the playhead", () => {
  assert.equal(resolvePreviewSubtitleText({ enabled: true, activeText: "Xin chào", editing: true }), "Xin chào");
  assert.equal(resolvePreviewSubtitleText({ enabled: true, activeText: "Xin chào", editing: false }), "Xin chào");
});

test("subtitle preview falls back to the sample only while the subtitle tab is being edited", () => {
  assert.equal(resolvePreviewSubtitleText({ enabled: true, activeText: null, editing: true }), SUBTITLE_SAMPLE_TEXT);
  assert.equal(resolvePreviewSubtitleText({ enabled: true, activeText: "   ", editing: true }), SUBTITLE_SAMPLE_TEXT);
  assert.equal(resolvePreviewSubtitleText({ enabled: true, activeText: undefined, editing: false }), null);
});
