import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { chapterNumberLabel } from "../src/renderer/features/chapters/model/chapter-ui.ts";

const chaptersScreen = fs.readFileSync(
  new URL("../src/renderer/features/chapters/screens/ChaptersScreen.tsx", import.meta.url),
  "utf8",
);
const chapterListPanel = fs.readFileSync(
  new URL("../src/renderer/features/chapters/components/ChapterListPanel.tsx", import.meta.url),
  "utf8",
);
const chapterQueries = fs.readFileSync(
  new URL("../src/renderer/features/chapters/queries/chapters.queries.ts", import.meta.url),
  "utf8",
);
const chapterAnalysisQueries = fs.readFileSync(
  new URL("../src/renderer/features/chapters/queries/chapter-analysis.queries.ts", import.meta.url),
  "utf8",
);
const compose = fs.readFileSync(new URL("../../../docker-compose.yml", import.meta.url), "utf8");

test("chapter numbering is one-based for display while orderIndex stays zero-based", () => {
  assert.equal(chapterNumberLabel(0), "Chapter 01");
  assert.equal(chapterNumberLabel(8), "Chapter 09");
  assert.equal(chapterNumberLabel(9), "Chapter 10");
});

test("chapter workspace defaults and resets sorting by chapter order", () => {
  assert.match(chaptersScreen, /useState<ChapterSort>\("order"\)/);
  assert.match(chaptersScreen, /setSortBy\("order"\)/);
  assert.match(chapterListPanel, /chapterNumberLabel\(chapter\.orderIndex\)/);
});

test("desktop does not serialize narration behind another selected chapter", () => {
  assert.doesNotMatch(chaptersScreen, /narrationBlockedByAnotherChapter/);
  assert.doesNotMatch(chaptersScreen, /\|\|\s*narrationJob\s*\|\|/);
  assert.match(chaptersScreen, /blockedByAnotherChapter: false/);
});

test("workspace batch polling follows active audio and analysis across chapters", () => {
  assert.match(chapterQueries, /isAnalysisProcessingStatus/);
  assert.match(chapterQueries, /batchQuery/);
  assert.match(chapterQueries, /pipeline\.audio\.status/);
  assert.match(chapterQueries, /pipeline\.analysis\.status/);
  assert.match(chapterQueries, /3000/);
});

test("chapter list exposes bulk audio and delegated bulk analysis admission", () => {
  assert.match(chapterListPanel, /Tạo audio tất cả/);
  assert.match(chapterListPanel, /Phân tích tất cả/);
  assert.match(chaptersScreen, /useGenerateBatchNarration/);
  assert.match(chaptersScreen, /generateBatchNarration/);
  assert.match(chaptersScreen, /useBulkChapterAnalysis/);
  assert.match(chaptersScreen, /bulkChapterAnalysis\.analyzeAll/);
  assert.match(chapterAnalysisQueries, /BULK_ANALYSIS_ADMISSION_CONCURRENCY = 4/);
  assert.match(chapterAnalysisQueries, /Promise\.allSettled/);
});

test("production narration defaults to two bounded concurrent jobs and inference slots", () => {
  assert.match(compose, /NARRATION_WORKER_CONCURRENCY:-2/);
  assert.match(compose, /VIENEU_INFERENCE_CONCURRENCY:-2/);
});
