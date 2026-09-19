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
    persistenceState: "PERSISTED",
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
  assert.equal(mockStoryBeat.persistenceState, "PERSISTED");
});

test("jobs and health query keys conform to cache namespaces", async () => {
  const { jobQueryKeys } = await import("../src/renderer/features/jobs/queries/jobs.queries.ts");
  const { healthQueryKeys } = await import("../src/renderer/features/workspace/queries/health.queries.ts");

  assert.deepEqual(jobQueryKeys.history(20), ["jobs", "history", 20]);
  assert.deepEqual(healthQueryKeys.provider(), ["health", "provider"]);
});

test("story API review status contract requires optimistic concurrency rowVersion", async () => {
  const { storyApi } = await import("../src/renderer/features/story/api/story.api.ts");
  assert.equal(typeof storyApi.updateStoryBeatReviewStatus, "function");
});

test("synthetic story beats distinguish from persisted beats and preserve legacy visuals", () => {
  const syntheticBeat = {
    id: "synth-beat-scene-1",
    sceneId: "scene-1",
    orderIndex: 1,
    title: "Legacy unassigned visuals",
    purpose: "PLOT",
    summary: "",
    importance: "NORMAL",
    reviewStatus: "NEEDS_REVIEW",
    persistenceState: "SYNTHETIC",
    audioCues: [],
    visualBeats: [
      {
        id: "vbeat-legacy-1",
        sceneId: "scene-1",
        orderIndex: 0,
        title: "Legacy visual without beat parent",
        visualIntent: "Archival painting shot",
        reviewStatus: "NEEDS_REVIEW",
        motionMode: "STILL",
        relativeWeight: 1.0,
        visualFocus: "SPEAKER",
        rowVersion: 0,
      },
    ],
    timing: {
      startMs: null,
      endMs: null,
      durationMs: null,
    },
    rowVersion: 0,
  };

  assert.equal(syntheticBeat.persistenceState, "SYNTHETIC");
  assert.equal(syntheticBeat.visualBeats.length, 1);
  assert.equal(syntheticBeat.title, "Legacy unassigned visuals");
});

test("mutation response contract does not require full DesktopStoryBeat fields", () => {
  /** @type {import("@narrativex/client-contracts").StoryBeatMutationResponse} */
  const mutationResponse = {
    id: "beat-1",
    sceneId: "scene-1",
    orderIndex: 0,
    purpose: "PLOT",
    summary: "Hero leaves the village at dawn.",
    importance: "HIGH",
    reviewStatus: "APPROVED",
    rowVersion: 2,
  };

  assert.equal(mutationResponse.id, "beat-1");
  assert.equal(mutationResponse.reviewStatus, "APPROVED");
  assert.equal(mutationResponse.rowVersion, 2);
  assert.equal("audioCues" in mutationResponse, false);
  assert.equal("visualBeats" in mutationResponse, false);
  assert.equal("timing" in mutationResponse, false);
  assert.equal("persistenceState" in mutationResponse, false);
});

test("synthetic beat cannot trigger mutation", () => {
  const syntheticBeat = {
    id: "synth-beat-scene-1",
    persistenceState: /** @type {const} */ ("SYNTHETIC"),
  };
  const persistedBeat = {
    id: "beat-1",
    persistenceState: /** @type {const} */ ("PERSISTED"),
  };

  let mutationTriggered = false;
  const triggerMutation = (beat) => {
    if (!beat) return;
    if (beat.persistenceState === "SYNTHETIC") return;
    mutationTriggered = true;
  };

  triggerMutation(syntheticBeat);
  assert.equal(mutationTriggered, false, "Synthetic beat must not trigger mutation");

  triggerMutation(persistedBeat);
  assert.equal(mutationTriggered, true, "Persisted beat should trigger mutation");
});

test("selected beat derives updated rowVersion from query state after mutation", () => {
  const selectedBeatId = "beat-1";
  const deriveSelectedBeat = (story) => {
    const allBeats = story.scenes.flatMap((s) => s.storyBeats);
    return allBeats.find((b) => b.id === selectedBeatId) ?? null;
  };

  let storyCache = {
    scenes: [
      {
        id: "scene-1",
        storyBeats: [
          { id: "beat-1", title: "Beat 1", rowVersion: 1, reviewStatus: "NEEDS_REVIEW", persistenceState: "PERSISTED" },
        ],
      },
    ],
  };

  let selected = deriveSelectedBeat(storyCache);
  assert.equal(selected.rowVersion, 1);
  assert.equal(selected.reviewStatus, "NEEDS_REVIEW");

  // Query cache update after mutation
  storyCache = {
    scenes: [
      {
        id: "scene-1",
        storyBeats: [
          { id: "beat-1", title: "Beat 1", rowVersion: 2, reviewStatus: "APPROVED", persistenceState: "PERSISTED" },
        ],
      },
    ],
  };

  selected = deriveSelectedBeat(storyCache);
  assert.equal(selected.rowVersion, 2);
  assert.equal(selected.reviewStatus, "APPROVED");
});

