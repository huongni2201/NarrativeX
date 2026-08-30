import test from "node:test";
import assert from "node:assert/strict";
import { activeSubtitleAt, planSubtitles } from "../src/shared/subtitle-planner.ts";

test("editor subtitle fallback follows the global narration span", () => {
  const cues = planSubtitles([
    {
      chapterId: "chapter-1",
      globalStartMs: 10_000,
      globalEndMs: 20_000,
      subtitleText: "Câu thứ nhất. Câu thứ hai.",
      subtitleSpansJson: null,
    },
  ]);

  assert.equal(cues[0].startMs, 10_000);
  assert.equal(cues.at(-1).endMs, 20_000);
  assert.equal(activeSubtitleAt(cues, 10_001)?.text, "Câu thứ nhất.");
  assert.equal(activeSubtitleAt(cues, 20_000), null);
});

test("editor subtitle alignment snaps a bounded tail drift to narration duration", () => {
  const cues = planSubtitles([
    {
      chapterId: "chapter-1",
      globalStartMs: 10_000,
      globalEndMs: 20_000,
      subtitleText: "Câu thứ nhất. Câu thứ hai.",
      subtitleSpansJson: JSON.stringify([
        { index: 0, textStart: 0, textEnd: 14, audioStartMs: 0, audioEndMs: 4_000 },
        { index: 1, textStart: 14, textEnd: 26, audioStartMs: 4_000, audioEndMs: 10_024 },
      ]),
    },
  ]);

  assert.equal(cues[0].timingSource, "NARRATION_ALIGNMENT");
  assert.equal(cues.at(-1).timingSource, "NARRATION_ALIGNMENT");
  assert.equal(cues.at(-1).endMs, 20_000);
});
