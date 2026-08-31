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

test("editor subtitle keeps a readable complete sentence in one cue", () => {
  const sentence =
    "Hắn đứng dậy rất chậm, nhìn về phía cánh cửa nhưng không thấy bất kỳ ai trong căn phòng đó.";
  const cues = planSubtitles([
    {
      chapterId: "chapter-1",
      globalStartMs: 0,
      globalEndMs: 8_000,
      subtitleText: sentence,
      subtitleSpansJson: null,
    },
  ]);

  assert.deepEqual(cues.map((cue) => cue.text), [sentence]);
});

test("editor subtitle balances long sentences instead of orphaning the final word", () => {
  const sentence =
    "Người đàn ông đứng lặng trước cánh cửa cũ trong căn phòng tối rất lâu nhưng cuối cùng vẫn không nhìn thấy bất kỳ ai đang ở phía sau nữa nữa nữa.";
  const cues = planSubtitles([
    {
      chapterId: "chapter-1",
      globalStartMs: 0,
      globalEndMs: 12_000,
      subtitleText: sentence,
      subtitleSpansJson: null,
    },
  ]);

  assert.equal(cues.length, 2);
  assert.notEqual(cues.at(-1)?.text, "nữa.");
  assert.ok(cues.every((cue) => cue.text.length <= 96));
});

test("editor subtitle merges an orphan alignment fragment back into its unfinished sentence", () => {
  const sentence = "Hắn đứng dậy rồi nhìn về phía cánh cửa nhưng không thấy bất kỳ ai.";
  const orphanStart = sentence.lastIndexOf("ai.");
  const cues = planSubtitles([
    {
      chapterId: "chapter-1",
      globalStartMs: 10_000,
      globalEndMs: 20_000,
      subtitleText: sentence,
      subtitleSpansJson: JSON.stringify([
        { index: 0, textStart: 0, textEnd: orphanStart, audioStartMs: 0, audioEndMs: 8_500 },
        {
          index: 1,
          textStart: orphanStart,
          textEnd: sentence.length,
          audioStartMs: 8_500,
          audioEndMs: 10_000,
        },
      ]),
    },
  ]);

  assert.equal(cues.length, 1);
  assert.equal(cues[0].text, sentence);
  assert.equal(cues[0].startMs, 10_000);
  assert.equal(cues[0].endMs, 20_000);
});

test("editor subtitle prefers a nearby clause boundary when balancing a long sentence", () => {
  const sentence =
    "Người đàn ông bước chậm qua hành lang tối rồi dừng trước cửa, nhưng bên trong căn phòng vẫn hoàn toàn im lặng như chưa từng có ai ở đó.";
  const cues = planSubtitles([
    {
      chapterId: "chapter-1",
      globalStartMs: 0,
      globalEndMs: 10_000,
      subtitleText: sentence,
      subtitleSpansJson: null,
    },
  ]);

  assert.equal(cues.length, 2);
  assert.ok(cues[0].text.endsWith(","));
});

test("editor subtitle preserves an intentional short sentence after terminal punctuation", () => {
  const sentence = "Anh có đi không? Không.";
  const shortSentenceStart = sentence.lastIndexOf("Không.");
  const cues = planSubtitles([
    {
      chapterId: "chapter-1",
      globalStartMs: 0,
      globalEndMs: 4_000,
      subtitleText: sentence,
      subtitleSpansJson: JSON.stringify([
        {
          index: 0,
          textStart: 0,
          textEnd: shortSentenceStart,
          audioStartMs: 0,
          audioEndMs: 2_500,
        },
        {
          index: 1,
          textStart: shortSentenceStart,
          textEnd: sentence.length,
          audioStartMs: 2_500,
          audioEndMs: 4_000,
        },
      ]),
    },
  ]);

  assert.deepEqual(cues.map((cue) => cue.text), ["Anh có đi không?", "Không."]);
});
