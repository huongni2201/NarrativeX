import test from "node:test";
import assert from "node:assert/strict";
import {
  mergeBackendProject,
  resolveProjectContinuation,
  withoutBackendWorkflow,
} from "../src/renderer/features/projects/model/project-continuation.ts";

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

test("resolveProjectContinuation falls back conservatively when backend workflow is unavailable", () => {
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
  assert.equal(continuation.destination, "/projects/proj-3/chapters?stage=source");
  assert.equal(continuation.stage, "source");
  assert.match(continuation.label, /source/i);
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

test("backend project state replaces workflow while local-only metadata survives", () => {
  const local = {
    id: "proj-6",
    name: "Old local name",
    description: null,
    coverImageUrl: null,
    status: "DRAFT",
    imageAspectRatio: "16:9",
    isStarred: true,
    lastOpenedAt: "2026-10-01T00:00:00Z",
    metrics: { totalChapters: 5, totalScenes: 12, estimatedDurationSeconds: 100 },
    workflow: { latestStage: "PRODUCTION" },
  };
  const backend = {
    id: "proj-6",
    name: "Current name",
    description: "Current description",
    coverImageUrl: null,
    status: "ACTIVE",
    isStarred: false,
    metrics: { totalChapters: 1, totalScenes: 0, estimatedDurationSeconds: 0 },
    workflow: {
      hasChapter: true,
      analysisReady: true,
      canonReady: false,
      storyReady: false,
      productionStarted: false,
      productionReady: false,
      editorReady: false,
      renderInProgress: false,
      latestStage: "CANON",
    },
  };

  const merged = mergeBackendProject(local, backend);

  assert.equal(merged.name, "Current name");
  assert.equal(merged.status, "ACTIVE");
  assert.equal(merged.isStarred, false);
  assert.deepEqual(merged.workflow, backend.workflow);
  assert.deepEqual(merged.metrics, backend.metrics);
  assert.equal(merged.imageAspectRatio, "16:9");
  assert.equal(merged.lastOpenedAt, "2026-10-01T00:00:00Z");
});

test("local fallback clears stale workflow authority", () => {
  const local = { id: "proj-7", workflow: { productionStarted: true } };
  assert.equal(withoutBackendWorkflow(local).workflow, null);
});
