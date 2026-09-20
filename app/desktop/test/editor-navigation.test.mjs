import test from "node:test";
import assert from "node:assert/strict";
import { screenFromWorkspacePath } from "../src/renderer/features/workspace/workspace-navigation.ts";

test("workspace routes resolve without coupling feature screens to EditorScreen", () => {
  assert.equal(screenFromWorkspacePath("/projects/p1/editor"), "editor");
  assert.equal(screenFromWorkspacePath("/projects/p1/chapters"), "chapters");
  assert.equal(screenFromWorkspacePath("/projects/p1/canon"), "canon");
  assert.equal(screenFromWorkspacePath("/projects/p1/assets"), "assets");
  assert.equal(screenFromWorkspacePath("/projects/p1/jobs"), "jobs");
  assert.equal(screenFromWorkspacePath("/projects/p1/render"), "render");
  assert.equal(screenFromWorkspacePath("/projects/p1/settings"), "settings");
});
