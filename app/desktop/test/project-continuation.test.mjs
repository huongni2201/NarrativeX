import test from "node:test";
import assert from "node:assert/strict";
import { resolveProjectContinuation } from "../src/renderer/features/projects/model/project-continuation.ts";

test("resolveProjectContinuation routes 0 chapter project to chapters workspace (source stage)", () => {
  const newProject = {
    id: "proj-1",
    name: "New Project",
    description: null,
    coverImageUrl: null,
    status: "DRAFT",
    metrics: {
      totalChapters: 0,
      totalScenes: 0,
      estimatedDurationSeconds: 0,
    },
  };

  const continuation = resolveProjectContinuation(newProject);
  assert.equal(continuation.destination, "/projects/proj-1/chapters?stage=source");
  assert.equal(continuation.stage, "source");
  assert.match(continuation.label, /viết kịch bản/i);
});

test("resolveProjectContinuation routes project without metrics to chapters workspace", () => {
  const newProject = {
    id: "proj-2",
    name: "New Project 2",
    description: null,
    coverImageUrl: null,
    status: "DRAFT",
  };

  const continuation = resolveProjectContinuation(newProject);
  assert.equal(continuation.destination, "/projects/proj-2/chapters?stage=source");
  assert.equal(continuation.stage, "source");
});

test("resolveProjectContinuation routes in-progress project without workflow to chapters workspace (production stage)", () => {
  const inProgressProject = {
    id: "proj-3",
    name: "In Progress",
    description: null,
    coverImageUrl: null,
    status: "DRAFT",
    metrics: {
      totalChapters: 2,
      totalScenes: 5,
      estimatedDurationSeconds: 120,
    },
  };

  const continuation = resolveProjectContinuation(inProgressProject);
  assert.equal(continuation.destination, "/projects/proj-3/chapters?stage=production");
  assert.equal(continuation.stage, "production");
  assert.match(continuation.label, /sản xuất/i);
});

test("resolveProjectContinuation routes based on workflow summary: renderInProgress", () => {
  const project = {
    id: "proj-4",
    name: "Rendering Film",
    description: null,
    coverImageUrl: null,
    status: "ACTIVE",
    workflow: {
      hasChapter: true,
      analysisReady: true,
      canonReady: true,
      storyReady: true,
      productionStarted: true,
      productionReady: true,
      editorReady: true,
      renderInProgress: true,
      latestStage: "RENDER",
    },
  };

  const continuation = resolveProjectContinuation(project);
  assert.equal(continuation.destination, "/projects/proj-4/editor");
  assert.match(continuation.label, /render/i);
});

test("resolveProjectContinuation routes based on workflow summary: canonReady to story", () => {
  const project = {
    id: "proj-5",
    name: "Story Planning",
    description: null,
    coverImageUrl: null,
    status: "ACTIVE",
    workflow: {
      hasChapter: true,
      analysisReady: true,
      canonReady: true,
      storyReady: false,
      productionStarted: false,
      productionReady: false,
      editorReady: false,
      renderInProgress: false,
      latestStage: "CANON",
    },
  };

  const continuation = resolveProjectContinuation(project);
  assert.equal(continuation.destination, "/projects/proj-5/chapters?stage=story");
  assert.equal(continuation.stage, "story");
  assert.match(continuation.label, /storyboard/i);
});
