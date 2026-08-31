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
const chapterEditorPanel = fs.readFileSync(
  new URL("../src/renderer/features/chapters/components/ChapterEditorPanel.tsx", import.meta.url),
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

test("chapter workspace defaults and resets sorting by chapter order", () => {
  assert.match(chaptersScreen, /useState<ChapterSort>\("order"\)/);
  assert.match(chaptersScreen, /setSortBy\("order"\)/);
  assert.match(chapterListPanel, /chapterNumberLabel\(chapter\.orderIndex\)/);
});

test("desktop generation state is backend-driven and has no cross-chapter narration lock", () => {
  assert.doesNotMatch(chaptersScreen, /narrationJob/);
  assert.doesNotMatch(chaptersScreen, /useGenerationJob/);
  assert.doesNotMatch(chaptersScreen, /blockedByAnotherChapter/);
  assert.doesNotMatch(chapterEditorPanel, /blockedByAnotherChapter/);
  assert.doesNotMatch(chapterEditorPanel, /trackedForSelected/);
  assert.doesNotMatch(chapterEditorPanel, /Một chapter khác đang tạo audio/);
});

test("workspace batch polling follows active audio and analysis across chapters", () => {
  assert.match(chapterQueries, /hasActiveChapterWork/);
  assert.match(chapterQueries, /isAnalysisProcessingStatus/);
  assert.match(chapterQueries, /batchQuery/);
  assert.match(chapterQueries, /pipeline\.audio\.status/);
  assert.match(chapterQueries, /pipeline\.analysis\.status/);
  assert.match(chapterQueries, /3000/);
});

test("chapter list exposes bulk audio and delegated bulk analysis admission", () => {
  assert.match(chapterListPanel, /onGenerateAudioAll/);
  assert.match(chapterListPanel, /onAnalyzeAll/);
  assert.match(chapterListPanel, /disabled=\{!canBulkAudio \|\| bulkAudioBusy\}/);
  assert.match(chapterListPanel, /disabled=\{!canBulkAnalysis \|\| bulkAnalysisBusy\}/);
  assert.match(chaptersScreen, /useGenerateBatchNarration/);
  assert.match(chaptersScreen, /generateBatchNarration/);
  assert.match(chaptersScreen, /useBulkChapterAnalysis/);
  assert.match(chaptersScreen, /bulkChapterAnalysis\.analyzeAll/);
  assert.match(chapterAnalysisQueries, /BULK_ANALYSIS_ADMISSION_CONCURRENCY = 4/);
  assert.match(chapterAnalysisQueries, /Promise\.allSettled/);
});

test("production narration defaults protect desktop CPU headroom", () => {
  assert.match(compose, /NARRATION_WORKER_CONCURRENCY:-1/);
  assert.match(compose, /VIENEU_BACKEND:-onnx/);
  assert.match(compose, /VIENEU_THREADS:-4/);
  assert.match(compose, /VIENEU_INFERENCE_CONCURRENCY:-1/);
  assert.match(compose, /OMP_NUM_THREADS: \"\$\{VIENEU_OMP_NUM_THREADS:-4\}\"/);
  assert.match(compose, /MKL_NUM_THREADS: \"\$\{VIENEU_MKL_NUM_THREADS:-4\}\"/);
  assert.match(compose, /OPENBLAS_NUM_THREADS: \"\$\{VIENEU_OPENBLAS_NUM_THREADS:-1\}\"/);
  assert.match(compose, /NUMEXPR_NUM_THREADS: \"\$\{VIENEU_NUMEXPR_NUM_THREADS:-1\}\"/);
  assert.match(compose, /cpus: \$\{NARRATION_WORKER_CPUS:-8\.0\}/);

  assert.match(envExample, /^NARRATION_WORKER_CONCURRENCY=1$/m);
  assert.match(envExample, /^NARRATION_WORKER_CPUS=8\.0$/m);
  assert.match(envExample, /^VIENEU_THREADS=4$/m);
  assert.match(envExample, /^VIENEU_INFERENCE_CONCURRENCY=1$/m);
  assert.match(envExample, /^VIENEU_OMP_NUM_THREADS=4$/m);
  assert.match(envExample, /^VIENEU_MKL_NUM_THREADS=4$/m);
  assert.match(envExample, /^VIENEU_OPENBLAS_NUM_THREADS=1$/m);
  assert.match(envExample, /^VIENEU_NUMEXPR_NUM_THREADS=1$/m);
});
