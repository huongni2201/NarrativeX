import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { classifyGeminiQueueGenerationError } from "../src/renderer/features/storyboard/model/gemini-queue.ts";

test("Gemini provider rejection skips only the rejected beat while infrastructure failures pause the queue", () => {
  assert.equal(
    classifyGeminiQueueGenerationError(
      new Error(
        "Error invoking remote method 'desktop:gemini-web:generate-image': GEMINI_GENERATION_REJECTED: [GEMINI_GENERATION_REJECTED] Gemini did not generate an image for this Visual Beat.",
      ),
    ),
    "SKIP_BEAT",
  );
  assert.equal(
    classifyGeminiQueueGenerationError("[GEMINI_GENERATION_REJECTED] Sorry, I can't generate unsafe images."),
    "SKIP_BEAT",
  );
  assert.equal(
    classifyGeminiQueueGenerationError(new Error("[GEMINI_AUTH_REQUIRED] Sign in again.")),
    "PAUSE_QUEUE",
  );
  assert.equal(
    classifyGeminiQueueGenerationError(new Error("Gemini shared Chrome session is unavailable.")),
    "PAUSE_QUEUE",
  );
});

test("Storyboard queue continues after a rejected beat instead of stopping the whole batch", () => {
  const source = readFileSync(
    "src/renderer/features/storyboard/screens/StoryboardScreen.tsx",
    "utf8",
  );
  assert.match(source, /classifyGeminiQueueGenerationError/);
  assert.match(
    source,
    /generationResult === "SKIP_BEAT"[\s\S]*markQueueBeatSkipped\(queue, beatId\)[\s\S]*publishGeminiQueue\(queue\)/,
  );
  assert.match(
    source,
    /generationResult === "PAUSE_QUEUE"[\s\S]*acceptNewWork = false/,
  );
});

test("Storyboard renders every concurrently generating beat as active instead of one current beat", () => {
  const screen = readFileSync(
    "src/renderer/features/storyboard/screens/StoryboardScreen.tsx",
    "utf8",
  );
  const grid = readFileSync(
    "src/renderer/features/storyboard/components/VisualBeatGrid.tsx",
    "utf8",
  );

  assert.match(screen, /const \[activeGeminiBeatIds, setActiveGeminiBeatIds\]/);
  assert.match(screen, /setActiveGeminiBeatIds\(new Set\(activeGeminiBeatIdsRef\.current\)\)/);
  assert.match(screen, /activeGeminiBeatIds=\{activeGeminiBeatIds\}/);
  assert.match(grid, /activeGeminiBeatIds: ReadonlySet<string>/);
  assert.match(grid, /activeGeminiBeatIds\.has\(beat\.id\)/);
  assert.match(grid, /queueRunning/);
  assert.match(grid, /Generating/);
});
