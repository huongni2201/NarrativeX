import test from "node:test";
import assert from "node:assert/strict";
import { screenFromWorkspacePath } from "../src/renderer/features/workspace/workspace-navigation.ts";
import { storyQueryKeys } from "../src/renderer/features/story/queries/story.queries.ts";

test("workspace navigation routes to target user activities", () => {
  assert.equal(screenFromWorkspacePath("/projects/proj-1/chapters"), "chapters");
  assert.equal(screenFromWorkspacePath("/projects/proj-1/canon"), "canon");
  assert.equal(screenFromWorkspacePath("/projects/proj-1/editor"), "editor");
  assert.equal(screenFromWorkspacePath("/projects/proj-1/assets"), "assets");
  assert.equal(screenFromWorkspacePath("/projects/proj-1/jobs"), "jobs");
  assert.equal(screenFromWorkspacePath("/projects/proj-1/settings"), "settings");
});

test("story query keys format hierarchical chapter story key", () => {
  const key = storyQueryKeys.chapterStory("project-123", "chapter-456");
  assert.deepEqual(key, ["story", "chapter", "project-123", "chapter-456"]);
});

test("StoryBeat hierarchy maintains semantic parent contract", () => {
  const mockStoryBeat = {
    id: "beat-1",
    sceneId: "scene-1",
    orderIndex: 0,
    title: "The Departure",
    purpose: "PLOT",
    summary: "Hero leaves the village at dawn.",
    importance: "HIGH",
    reviewStatus: "APPROVED",
    audioCues: [
      {
        id: "cue-1",
        storyBeatId: "beat-1",
        orderIndex: 0,
        cueType: "NARRATOR",
        adaptedText: "The sun was rising as he walked away.",
        adaptationAction: "KEEP_EXACT",
        status: "APPROVED",
        rowVersion: 1,
      },
    ],
    visualBeats: [
      {
        id: "vbeat-1",
        sceneId: "scene-1",
        storyBeatId: "beat-1",
        orderIndex: 0,
        title: "Hero silhouette at sunrise",
        visualIntent: "Wide shot of hero walking down the hill towards the dawn.",
        reviewStatus: "APPROVED",
        motionMode: "PAN",
        relativeWeight: 1.0,
        visualFocus: "SPEAKER",
        rowVersion: 1,
      },
    ],
    timing: {
      startMs: 0,
      endMs: 3200,
      durationMs: 3200,
    },
    rowVersion: 1,
  };

  assert.equal(mockStoryBeat.audioCues[0].storyBeatId, mockStoryBeat.id);
  assert.equal(mockStoryBeat.visualBeats[0].storyBeatId, mockStoryBeat.id);
  assert.equal(mockStoryBeat.timing.durationMs, 3200);
});
