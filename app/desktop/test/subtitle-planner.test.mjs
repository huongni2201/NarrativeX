import test from "node:test";
import assert from "node:assert/strict";
import { planChapterSubtitles } from "../src/main/rendering/subtitle-planner.ts";
import { formatSrtTime } from "../src/main/rendering/subtitle-srt.ts";

test("uses immutable narration alignment offsets for subtitle timing", () => {
  const text = "Xin chào thế giới. Đây là NarrativeX.";
  const spans = JSON.stringify([
    { index: 0, textStart: 0, textEnd: 18, audioStartMs: 0, audioEndMs: 1400 },
    { index: 1, textStart: 19, textEnd: text.length, audioStartMs: 1400, audioEndMs: 3000 },
  ]);

  const cues = planChapterSubtitles({
    chapterId: "chapter-1",
    globalStartMs: 5000,
    globalEndMs: 8000,
    subtitleText: text,
    subtitleSpansJson: spans,
  });

  assert.equal(cues[0].startMs, 5000);
  assert.equal(cues[0].endMs, 6400);
  assert.equal(cues[0].text, "Xin chào thế giới.");
  assert.equal(cues[0].timingSource, "NARRATION_ALIGNMENT");
  assert.equal(cues.at(-1).endMs, 8000);
});

test("falls back to deterministic text-weight timing when alignment is absent", () => {
  const cues = planChapterSubtitles({
    chapterId: "chapter-1",
    globalStartMs: 0,
    globalEndMs: 4000,
    subtitleText: "Câu thứ nhất. Câu thứ hai dài hơn một chút.",
    subtitleSpansJson: null,
  });

  assert.ok(cues.length >= 2);
  assert.equal(cues[0].startMs, 0);
  assert.equal(cues.at(-1).endMs, 4000);
  assert.ok(cues.every((cue) => cue.timingSource === "TEXT_WEIGHT_FALLBACK"));
});

test("invalid alignment never escapes chapter clock", () => {
  const cues = planChapterSubtitles({
    chapterId: "chapter-1",
    globalStartMs: 1000,
    globalEndMs: 3000,
    subtitleText: "Một câu hợp lệ.",
    subtitleSpansJson: JSON.stringify([
      { index: 0, textStart: 0, textEnd: 999, audioStartMs: 0, audioEndMs: 9000 },
    ]),
  });

  assert.ok(cues.length > 0);
  assert.equal(cues[0].startMs, 1000);
  assert.equal(cues.at(-1).endMs, 3000);
});

test("formats SRT timecode", () => {
  assert.equal(formatSrtTime(3_723_045), "01:02:03,045");
});
