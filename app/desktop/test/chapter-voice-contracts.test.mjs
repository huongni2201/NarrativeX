import assert from "node:assert/strict";
import test from "node:test";
import { parseChapterWorkspace } from "../src/renderer/features/chapters/api/chapter-workspace-contract.ts";
import { filterVoices, playableSampleUrl } from "../src/renderer/features/voices/voice-filters.ts";

const workspace = {
  chapter: {
    id: "chapter-1",
    storyVersionId: "story-1",
    orderIndex: 0,
    title: "Chapter 1",
    sourceText: "A story.",
    sourceHash: "hash",
    rowVersion: 1,
  },
  projectName: "Test",
  summary: { sceneCount: 2, visualBeatCount: 3, estimatedDurationSeconds: 120 },
  pipeline: {
    analysis: { status: "COMPLETED", completedAt: "2026-08-25T00:00:00Z" },
    visualPlanning: { status: "COMPLETED", completedAt: "2026-08-25T00:00:00Z" },
    visualGeneration: { status: "NOT_STARTED", total: 0, completed: 0, failed: 0 },
    audio: { status: "NOT_STARTED", completedAt: null, audioUrl: null, durationMs: null },
    render: { status: "NOT_STARTED", completedAt: null, latestJobId: null, artifactId: null },
    sourceOutdated: false,
  },
  previewScenes: [
    {
      id: "scene-1",
      orderIndex: 0,
      title: "Opening",
      durationSeconds: 30,
      status: "DRAFT",
      visualBeatCount: 1,
      previewImageUrl: null,
    },
  ],
  capabilities: {
    canAnalyze: true,
    canGenerateVisuals: false,
    canGenerateAudio: true,
    canRender: false,
    visualGenerationBlockReason: "No approved asset",
  },
};

test("chapter workspace parser accepts the backend shape and rejects malformed data", () => {
  assert.equal(parseChapterWorkspace(workspace).projectName, "Test");
  assert.throws(() => parseChapterWorkspace({ ...workspace, summary: null }), /contract/);
});

test("voice tag filtering updates the result set", () => {
  const voices = [
    { id: "vi", provider: "VIENEU", name: "Ngọc", language: "vi-VN", gender: "FEMALE", sampleUrl: null },
    { id: "en", provider: "GOOGLE", name: "Alex", language: "en-US", gender: "MALE", sampleUrl: null },
  ];

  assert.deepEqual(
    filterVoices(voices, { query: "", language: "all", gender: "all", provider: "all", tag: "vi-VN", sortMode: "name-asc" }).map((voice) => voice.id),
    ["vi"],
  );
});

test("voice preview only accepts HTTP(S) media URLs", () => {
  assert.equal(playableSampleUrl("https://media.example.test/sample.wav"), "https://media.example.test/sample.wav");
  assert.equal(playableSampleUrl("file:///secret/sample.wav"), null);
  assert.equal(playableSampleUrl("not-a-url"), null);
});
