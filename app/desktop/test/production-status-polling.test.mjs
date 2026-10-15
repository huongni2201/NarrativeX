import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  productionPollInterval,
  shouldRefetchProduction,
} from "../src/renderer/features/production/queries/production-cache.ts";

const status = (overrides = {}) => ({
  chapterId: "chapter-1",
  storyReady: true,
  audioReady: true,
  voiceReady: true,
  totalShots: 4,
  queuedShots: 0,
  generatingShots: 0,
  validatingShots: 0,
  passedShots: 1,
  failedShots: 0,
  blockedShots: 0,
  manualReviewShots: 0,
  selectedTakeCount: 1,
  generationReady: true,
  timelineReady: false,
  renderReady: false,
  overallProgressPercent: 25,
  activeGenerationJobId: null,
  productionSignature: "sig-a",
  ...overrides,
});

test("an unchanged productionSignature does not refetch the full production view", () => {
  assert.equal(shouldRefetchProduction(status(), status()), false);
  assert.equal(
    shouldRefetchProduction(status(), status({ overallProgressPercent: 50 })),
    false,
    "only the signature decides, counters alone do not",
  );
});

test("a changed productionSignature refetches the full production view", () => {
  assert.equal(
    shouldRefetchProduction(status(), status({ productionSignature: "sig-b" })),
    true,
  );
});

test("the first status of a chapter never triggers a refetch", () => {
  assert.equal(shouldRefetchProduction(undefined, status()), false);
  assert.equal(
    shouldRefetchProduction(
      status({ chapterId: "chapter-1" }),
      status({ chapterId: "chapter-2", productionSignature: "sig-z" }),
    ),
    false,
  );
});

test("a status without a signature conservatively refetches", () => {
  assert.equal(
    shouldRefetchProduction(
      status({ productionSignature: null }),
      status({ productionSignature: null, queuedShots: 1 }),
    ),
    true,
  );
});

test("the heavy production query is not polled", () => {
  const source = readFileSync(
    new URL("../src/renderer/features/production/queries/video-production.queries.ts", import.meta.url),
    "utf8",
  );
  const start = source.indexOf("export function useChapterProduction(");
  const end = source.indexOf("export function useGenerateShot");
  assert.ok(start >= 0 && end > start, "useChapterProduction must exist");
  assert.equal(source.slice(start, end).includes("refetchInterval"), false);
});

test("the status poll keeps its SSE-aware cadence", () => {
  assert.equal(productionPollInterval(false, true), false);
  assert.equal(productionPollInterval(true, true), 30_000);
  assert.equal(productionPollInterval(true, false), 3_000);
  assert.equal(productionPollInterval(false, false), 15_000);
});
