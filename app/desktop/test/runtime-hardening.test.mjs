import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import test from "node:test";

const desktopRoot = resolve(dirname(import.meta.filename), "..");
const repoRoot = resolve(desktopRoot, "..", "..");

function source(...parts) {
  return readFileSync(join(repoRoot, ...parts), "utf8");
}

test("chapter workspace keeps an explicit create mode and blocks generation from dirty drafts", () => {
  const chapters = source(
    "app",
    "desktop",
    "src",
    "renderer",
    "features",
    "chapters",
    "screens",
    "ChaptersScreen.tsx",
  );
  assert.match(chapters, /setIsCreating\(true\)/);
  assert.match(chapters, /generationBlockedByUnsavedChanges/);
  assert.match(chapters, /busy \|\| generationBlockedByUnsavedChanges/);
  assert.doesNotMatch(chapters, /setPage\(2\)/);
  assert.match(chapters, /Math\.min\(Math\.max\(current, 1\), totalPages\)/);
});

test("workspace follows cursor pagination and does not hide partial API failures", () => {
  const workspace = source(
    "app",
    "desktop",
    "src",
    "renderer",
    "features",
    "workspace",
    "queries",
    "useProjectWorkspace.ts",
  );
  assert.match(workspace, /chaptersApi\.listAll/);
  assert.match(workspace, /assetsApi\.listAll/);
  assert.match(workspace, /charactersApi\.listAll/);
  assert.match(workspace, /firstError[\s\S]*?\? timeline[\s\S]*?\? "partial"[\s\S]*?: "error"/);
});

test("chapter polling is scoped to the selected chapter", () => {
  const queries = source(
    "app",
    "desktop",
    "src",
    "renderer",
    "features",
    "chapters",
    "queries",
    "chapters.queries.ts",
  );
  assert.match(queries, /chapter\.id === pollingChapterId/);
});

test("chapter analysis carries an idempotency key", () => {
  const generation = source(
    "app",
    "desktop",
    "src",
    "renderer",
    "features",
    "generation",
    "api",
    "generation.api.ts",
  );
  assert.match(
    generation,
    /analysis-jobs[\s\S]*?"Idempotency-Key": crypto\.randomUUID\(\)/,
  );
});

test("compose file mounts required files without creating missing host directories", () => {
  const compose = source("docker-compose.yml");
  assert.match(compose, /condition: service_healthy/);
  assert.match(compose, /type: bind[\s\S]*?source: \.\/app\/ai-worker\/scripts/);
  assert.doesNotMatch(compose, /source: \.\/app\/ai-worker\/artifacts/);
});
