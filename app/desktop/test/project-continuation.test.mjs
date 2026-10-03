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
  assert.equal(continuation.destination, "/projects/proj-1/chapters");
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
  assert.equal(continuation.destination, "/projects/proj-2/chapters");
  assert.equal(continuation.stage, "source");
});

test("resolveProjectContinuation routes in-progress project to chapters workspace (production stage)", () => {
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
  assert.equal(continuation.destination, "/projects/proj-3/chapters");
  assert.equal(continuation.stage, "production");
  assert.match(continuation.label, /sản xuất/i);
});

test("resolveProjectContinuation routes READY or COMPLETED project to timeline editor", () => {
  const readyProject = {
    id: "proj-4",
    name: "Ready Film",
    description: null,
    coverImageUrl: null,
    status: "READY",
    metrics: {
      totalChapters: 3,
      totalScenes: 8,
      estimatedDurationSeconds: 300,
    },
  };

  const continuation = resolveProjectContinuation(readyProject);
  assert.equal(continuation.destination, "/projects/proj-4/editor");
  assert.match(continuation.label, /timeline/i);
});
