import test from "node:test";
import assert from "node:assert/strict";
import { activeSubtitleAt, planSubtitles } from "../src/shared/subtitle-planner.ts";

function wordsFor(text, timings) {
  const matches = [...text.matchAll(/[^\s.,!?;:]+/gu)];
  assert.equal(matches.length, timings.length);
  return matches.map((match, index) => ({
    index,
    textStart: match.index,
    textEnd: match.index + match[0].length,
    audioStartMs: timings[index][0],
    audioEndMs: timings[index][1],
    confidence: 0.98,
  }));
}

test("subtitle is omitted when authoritative word alignment is missing", () => {
  const cues = planSubtitles([
    {
      chapterId: "chapter-1",
      globalStartMs: 10_000,
      globalEndMs: 20_000,
      subtitleText: "Câu thứ nhất. Câu thứ hai.",
      subtitleWordsJson: null,
    },
  ]);

  assert.deepEqual(cues, []);
});

test("subtitle preserves leading and trailing silence", () => {
  const text = "Xin chào bạn.";
  const words = wordsFor(text, [
    [500, 850],
    [900, 1_250],
    [1_300, 1_600],
  ]);
  const cues = planSubtitles([
    {
      chapterId: "chapter-1",
      globalStartMs: 10_000,
      globalEndMs: 15_000,
      subtitleText: text,
      subtitleWordsJson: JSON.stringify(words),
    },
  ]);

  assert.equal(cues.length, 1);
  assert.equal(cues[0].startMs, 10_500);
  assert.equal(cues[0].endMs, 11_600);
  assert.equal(cues[0].text, text);
  assert.equal(cues[0].timingSource, "WORD_ALIGNMENT");
  assert.equal(activeSubtitleAt(cues, 10_200), null);
  assert.equal(activeSubtitleAt(cues, 12_000), null);
});

test("long spoken pause creates a subtitle-free gap", () => {
  const text = "Anh nhìn cô. Cô quay đi.";
  const words = wordsFor(text, [
    [100, 300],
    [330, 570],
    [600, 820],
    [1_700, 1_920],
    [1_950, 2_180],
    [2_220, 2_430],
  ]);
  const cues = planSubtitles([
    {
      chapterId: "chapter-1",
      globalStartMs: 0,
      globalEndMs: 4_000,
      subtitleText: text,
      subtitleWordsJson: JSON.stringify(words),
    },
  ]);

  assert.deepEqual(cues.map((cue) => cue.text), ["Anh nhìn cô.", "Cô quay đi."]);
  assert.equal(cues[0].endMs, 820);
  assert.equal(cues[1].startMs, 1_700);
  assert.equal(activeSubtitleAt(cues, 1_200), null);
});

test("terminal punctuation closes a cue at the measured last word time", () => {
  const text = "Anh có đi không? Không.";
  const words = wordsFor(text, [
    [0, 200],
    [230, 400],
    [430, 600],
    [630, 850],
    [1_000, 1_350],
  ]);
  const cues = planSubtitles([
    {
      chapterId: "chapter-1",
      globalStartMs: 0,
      globalEndMs: 3_000,
      subtitleText: text,
      subtitleWordsJson: JSON.stringify(words),
    },
  ]);

  assert.deepEqual(cues.map((cue) => cue.text), ["Anh có đi không?", "Không."]);
  assert.deepEqual(cues.map((cue) => [cue.startMs, cue.endMs]), [
    [0, 850],
    [1_000, 1_350],
  ]);
});

test("invalid word alignment never falls back to proportional text timing", () => {
  const cues = planSubtitles([
    {
      chapterId: "chapter-1",
      globalStartMs: 0,
      globalEndMs: 4_000,
      subtitleText: "Một câu ngắn.",
      subtitleWordsJson: JSON.stringify([
        {
          index: 0,
          textStart: 0,
          textEnd: 3,
          audioStartMs: 500,
          audioEndMs: 4_500,
          confidence: 0.9,
        },
      ]),
    },
  ]);

  assert.deepEqual(cues, []);
});
