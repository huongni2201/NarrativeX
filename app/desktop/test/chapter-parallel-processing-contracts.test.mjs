import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { chapterNumberLabel } from "../src/renderer/features/chapters/model/chapter-ui.ts";

const chapterWorkspaceScreen = fs.readFileSync(
  new URL("../src/renderer/features/chapters/screens/ChapterWorkspaceScreen.tsx", import.meta.url),
  "utf8",
);
const chapterRail = fs.readFileSync(
  new URL("../src/renderer/features/chapters/components/ChapterRail.tsx", import.meta.url),
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
const envExample = fs.readFileSync(new URL("../../../.env.example", import.meta.url), "utf8");

test("chapter numbering is one-based for display while orderIndex stays zero-based", () => {
  assert.equal(chapterNumberLabel(0), "Chapter 01");
  assert.equal(chapterNumberLabel(8), "Chapter 09");
  assert.equal(chapterNumberLabel(9), "Chapter 10");
});

test("chapter rail and workspace list chapters with order index display", () => {
  assert.match(chapterWorkspaceScreen, /Chương \$\{nextOrder \+ 1\}/);
  assert.match(chapterRail, /filteredChapters/);
  assert.match(chapterRail, /onCreateChapter/);
});

test("desktop generation state is backend-driven and has no cross-chapter narration lock", () => {
  assert.doesNotMatch(chapterWorkspaceScreen, /narrationJob/);
  assert.doesNotMatch(chapterWorkspaceScreen, /blockedByAnotherChapter/);
  assert.doesNotMatch(chapterWorkspaceScreen, /trackedForSelected/);
  assert.doesNotMatch(chapterWorkspaceScreen, /Một chapter khác đang tạo audio/);
});

test("workspace batch polling follows active audio and analysis across chapters", () => {
  assert.match(chapterQueries, /hasActiveChapterWork/);
  assert.match(chapterQueries, /isAnalysisProcessingStatus/);
  assert.match(chapterQueries, /batchQuery/);
  assert.match(chapterQueries, /pipeline\.audio\.status/);
  assert.match(chapterQueries, /pipeline\.analysis\.status/);
  assert.match(chapterQueries, /3000/);
});

test("chapter analysis queries support batch processing and concurrency limit", () => {
  assert.match(chapterAnalysisQueries, /BULK_ANALYSIS_ADMISSION_CONCURRENCY = 4/);
  assert.match(chapterAnalysisQueries, /Promise\.allSettled/);
});
