import test from "node:test";
import assert from "node:assert/strict";
import {
  buildEditorHierarchy,
  findEditorBeatAtTime,
  resolveEditorScopeWindow,
  sortEditorBeats,
} from "../src/renderer/features/editor/editor-timeline.ts";

const chapters = [
  {
    chapterId: "chapter-2",
    orderIndex: 1,
    title: "Chapter 2",
    startMs: 20_000,
    endMs: 32_000,
    audioReady: true,
    readyForRender: true,
    narrationAssetId: "audio-2",
  },
  {
    chapterId: "chapter-1",
    orderIndex: 0,
    title: "Chapter 1",
    startMs: 0,
    endMs: 20_000,
    audioReady: true,
    readyForRender: false,
    narrationAssetId: "audio-1",
  },
];

const beats = [
  beat("chapter-1", 1, 2, "beat-3", 12_000, 20_000),
  beat("chapter-2", 0, 0, "beat-4", 20_000, 32_000),
  beat("chapter-1", 0, 1, "beat-2", 5_000, 12_000),
  beat("chapter-1", 0, 0, "beat-1", 0, 5_000),
];

test("editor hierarchy preserves Chapter -> Scene -> Visual Beat ordering", () => {
  const hierarchy = buildEditorHierarchy(chapters, beats);

  assert.deepEqual(
    hierarchy.map((group) => group.chapter.chapterId),
    ["chapter-1", "chapter-2"],
  );
  assert.deepEqual(
    hierarchy[0].scenes.map((scene) => scene.sceneIndex),
    [0, 1],
  );
  assert.deepEqual(
    hierarchy[0].scenes[0].beats.map((item) => item.visualBeatId),
    ["beat-1", "beat-2"],
  );
  assert.equal(hierarchy[0].scenes[0].durationMs, 12_000);
});

test("editor playback orders beats before previous/next navigation", () => {
  assert.deepEqual(
    sortEditorBeats(beats).map((item) => item.visualBeatId),
    ["beat-1", "beat-2", "beat-3", "beat-4"],
  );
});

test("editor playback resolves boundaries and includes the final endpoint", () => {
  assert.equal(findEditorBeatAtTime(beats, 0)?.visualBeatId, "beat-1");
  assert.equal(findEditorBeatAtTime(beats, 5_000)?.visualBeatId, "beat-2");
  assert.equal(findEditorBeatAtTime(beats, 12_000)?.visualBeatId, "beat-3");
  assert.equal(findEditorBeatAtTime(beats, 32_000)?.visualBeatId, "beat-4");
  assert.equal(findEditorBeatAtTime(beats, 32_001), null);
});

test("editor scope resolves beat, scene, chapter and project windows without prerender grouping", () => {
  const selected = beats.find((item) => item.visualBeatId === "beat-2");
  assert.ok(selected);

  const beatWindow = resolveEditorScopeWindow({
    chapters,
    beats,
    selected,
    scope: "beat",
    totalMs: 32_000,
  });
  assert.deepEqual(
    [beatWindow.startMs, beatWindow.endMs, beatWindow.beats.map((item) => item.visualBeatId)],
    [5_000, 12_000, ["beat-2"]],
  );

  const sceneWindow = resolveEditorScopeWindow({
    chapters,
    beats,
    selected,
    scope: "scene",
    totalMs: 32_000,
  });
  assert.deepEqual(
    [sceneWindow.startMs, sceneWindow.endMs, sceneWindow.beats.map((item) => item.visualBeatId)],
    [0, 12_000, ["beat-1", "beat-2"]],
  );

  const chapterWindow = resolveEditorScopeWindow({
    chapters,
    beats,
    selected,
    scope: "chapter",
    totalMs: 32_000,
  });
  assert.deepEqual(
    [chapterWindow.startMs, chapterWindow.endMs, chapterWindow.beats.map((item) => item.visualBeatId)],
    [0, 20_000, ["beat-1", "beat-2", "beat-3"]],
  );

  const projectWindow = resolveEditorScopeWindow({
    chapters,
    beats,
    selected,
    scope: "project",
    totalMs: 32_000,
  });
  assert.deepEqual(
    [projectWindow.startMs, projectWindow.endMs, projectWindow.beats.length],
    [0, 32_000, 4],
  );
});

function beat(chapterId, sceneIndex, beatIndex, visualBeatId, startMs, endMs) {
  return {
    chapterId,
    sceneIndex,
    beatIndex,
    visualBeatId,
    title: visualBeatId,
    visualIntent: "visual intent",
    cameraMovement: "STATIC",
    assetStrategy: "GENERATE",
    mediaAssetId: null,
    startMs,
    endMs,
    durationMs: endMs - startMs,
    assetReady: visualBeatId !== "beat-3",
  };
}
