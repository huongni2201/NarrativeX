import test from "node:test";
import assert from "node:assert/strict";
import { getRenderReadinessBlockers } from "../src/renderer/features/production/render-readiness.ts";

function timeline(overrides = {}) {
  return {
    projectId: "project-1",
    storyVersionId: "story-1",
    totalDurationMs: 10_000,
    aspectRatio: "16:9",
    readyForRender: true,
    chapters: [
      {
        chapterId: "chapter-1",
        orderIndex: 0,
        title: "Chapter 1",
        startMs: 0,
        endMs: 10_000,
        audioReady: true,
        readyForRender: true,
        narrationAssetId: "audio-1",
      },
    ],
    beats: [
      {
        chapterId: "chapter-1",
        sceneIndex: 0,
        beatIndex: 0,
        visualBeatId: "beat-1",
        title: "Beat 1",
        visualIntent: "Visual",
        cameraMovement: "NONE",
        assetStrategy: "GENERATE_NEW",
        mediaAssetId: "image-1",
        mediaType: "IMAGE",
        storageMode: "LOCAL_ONLY",
        sourceDurationMs: null,
        fitMode: "TRIM",
        trimStartMs: 0,
        mediaSelectionActive: false,
        startMs: 0,
        endMs: 10_000,
        durationMs: 10_000,
        assetReady: true,
      },
    ],
    ...overrides,
  };
}

test("ready local-first timeline has no blockers", () => {
  assert.deepEqual(getRenderReadinessBlockers(timeline()), []);
});

test("missing generated media is reported explicitly", () => {
  const input = timeline({
    readyForRender: false,
    beats: [
      {
        ...timeline().beats[0],
        mediaAssetId: null,
        mediaType: null,
        storageMode: null,
        assetReady: false,
      },
    ],
  });

  assert.deepEqual(getRenderReadinessBlockers(input), ["Beat 1: thiếu media READY."]);
});

test("timing blocker is reported when assets and narration are ready", () => {
  assert.deepEqual(getRenderReadinessBlockers(timeline({ readyForRender: false })), [
    "Timing Visual Beat chưa liên tục hoặc chưa phủ hết narration.",
  ]);
});

test("narration blocker names the chapter", () => {
  const input = timeline({
    readyForRender: false,
    chapters: [
      {
        ...timeline().chapters[0],
        audioReady: false,
        readyForRender: false,
        narrationAssetId: null,
      },
    ],
  });
  assert.deepEqual(getRenderReadinessBlockers(input), ["Chapter 1: narration chưa READY."]);
});
