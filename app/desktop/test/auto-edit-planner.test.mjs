import test from "node:test";
import assert from "node:assert/strict";
import {
  chooseCameraMovement,
  chooseMediaFit,
  createAutoEditPlan,
} from "../src/renderer/features/production/auto-edit-planner.ts";

function beat(overrides = {}) {
  return {
    chapterId: "chapter-1",
    sceneIndex: 0,
    beatIndex: 0,
    visualBeatId: "beat-1",
    title: "A secret is revealed",
    visualIntent: "Close-up reaction as the character discovers the truth.",
    cameraMovement: "NONE",
    assetStrategy: "GENERATE",
    mediaAssetId: "asset-1",
    mediaType: "IMAGE",
    storageMode: "REMOTE",
    sourceDurationMs: null,
    fitMode: "TRIM",
    trimStartMs: 0,
    mediaSelectionActive: false,
    startMs: 0,
    endMs: 6000,
    durationMs: 6000,
    assetReady: true,
    ...overrides,
  };
}

test("image beats use narration duration and semantic motion", () => {
  const input = beat();
  assert.equal(chooseMediaFit(input).fitMode, "TRIM");
  assert.equal(chooseCameraMovement(input, "CINEMATIC"), "PUSH_IN");
});

test("long video is automatically trimmed to a centered window", () => {
  const decision = chooseMediaFit({
    mediaType: "VIDEO",
    sourceDurationMs: 20_000,
    durationMs: 8_000,
  });
  assert.deepEqual(decision, {
    fitMode: "TRIM",
    trimStartMs: 6000,
    reason: "Source video is longer than the narration span; Auto Edit selects a centered usable window.",
  });
});

test("near-duration video uses speed adjust instead of manual fitting", () => {
  assert.equal(
    chooseMediaFit({ mediaType: "VIDEO", sourceDurationMs: 7_200, durationMs: 8_000 }).fitMode,
    "SPEED_ADJUST",
  );
});

test("short video freezes or loops based on duration ratio", () => {
  assert.equal(
    chooseMediaFit({ mediaType: "VIDEO", sourceDurationMs: 5_000, durationMs: 8_000 }).fitMode,
    "FREEZE_END",
  );
  assert.equal(
    chooseMediaFit({ mediaType: "VIDEO", sourceDurationMs: 2_000, durationMs: 8_000 }).fitMode,
    "LOOP",
  );
});

test("auto edit plan emits only render parameters that differ from timeline", () => {
  const timeline = {
    projectId: "project-1",
    storyVersionId: "story-1",
    totalDurationMs: 8000,
    aspectRatio: "16:9",
    readyForRender: true,
    chapters: [],
    beats: [
      beat({
        mediaType: "VIDEO",
        sourceDurationMs: 20_000,
        durationMs: 8_000,
        endMs: 8_000,
        fitMode: "FREEZE_END",
      }),
    ],
  };

  const plan = createAutoEditPlan(timeline, "CINEMATIC");
  assert.equal(plan.version, 1);
  assert.deepEqual(plan.renderOverrides, [
    {
      visualBeatId: "beat-1",
      fitMode: "TRIM",
      trimStartMs: 6000,
    },
  ]);
});
