import test from "node:test";
import assert from "node:assert/strict";
import { planBeatTransitions } from "../src/main/rendering/transition-planner.ts";

const beat = (visualBeatId, chapterId, sceneIndex, durationMs = 5000) => ({
  visualBeatId,
  chapterId,
  sceneIndex,
  durationMs,
});

test("regular beat and scene boundaries stay hard cuts", () => {
  const plans = planBeatTransitions([
    beat("beat-1", "chapter-1", 0),
    beat("beat-2", "chapter-1", 1),
  ]);

  assert.deepEqual(plans, [
    {
      visualBeatId: "beat-1",
      transitionInMs: 0,
      transitionOutMs: 0,
      transitionType: "CUT",
    },
    {
      visualBeatId: "beat-2",
      transitionInMs: 0,
      transitionOutMs: 0,
      transitionType: "CUT",
    },
  ]);
});

test("chapter boundary gets symmetric fade-through-black without changing durations", () => {
  const plans = planBeatTransitions([
    beat("beat-1", "chapter-1", 2, 5000),
    beat("beat-2", "chapter-2", 0, 4000),
  ]);

  assert.equal(plans[0].transitionType, "FADE_BLACK");
  assert.equal(plans[0].transitionOutMs, 180);
  assert.equal(plans[1].transitionType, "FADE_BLACK");
  assert.equal(plans[1].transitionInMs, 180);
});

test("very short beats do not receive fades", () => {
  const plans = planBeatTransitions([
    beat("beat-1", "chapter-1", 0, 500),
    beat("beat-2", "chapter-2", 0, 500),
  ]);

  assert.equal(plans[0].transitionOutMs, 0);
  assert.equal(plans[1].transitionInMs, 0);
});
