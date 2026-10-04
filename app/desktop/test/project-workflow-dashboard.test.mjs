import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const desktop = new URL("../src/renderer/features/projects/", import.meta.url);

test("Projects loads workflow from the backend dashboard and falls back conservatively", () => {
  const queries = readFileSync(new URL("queries/projects.queries.ts", desktop), "utf8");
  const api = readFileSync(new URL("api/projects.api.ts", desktop), "utf8");

  assert.match(api, /\/api\/v1\/projects\/dashboard/);
  assert.match(queries, /readBackendProjectSummaries\(localProjects\.map/);
  assert.match(queries, /mergeBackendProject\(localProject, backendProject\)/);
  assert.match(queries, /withoutBackendWorkflow\(localProject\)/);
  assert.match(queries, /repeated cursor/);
});
