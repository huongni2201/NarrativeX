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

test("chapter CRUD writes refresh chapter and backend-derived timeline data", () => {
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
  assert.match(queries, /function invalidateChapterData/);
  assert.match(queries, /chapterQueryKeys\.all\(projectId\)/);
  assert.match(queries, /\["projects", projectId, "timeline"\]/);
  assert.equal((queries.match(/onSuccess: \(\) => invalidateChapterData\(queryClient, projectId\)/g) ?? []).length, 3);
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

test("chapter polling follows active work across the batch", () => {
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
  assert.match(queries, /function hasActiveChapterWork/);
  assert.match(queries, /isAudioProcessingStatus/);
  assert.match(queries, /isAnalysisProcessingStatus/);
  assert.match(queries, /hasActiveChapterWork\(query\.state\.data/);
});

test("storyboard review filter uses the themed select primitive", () => {
  const storyboard = source(
    "app",
    "desktop",
    "src",
    "renderer",
    "features",
    "storyboard",
    "screens",
    "StoryboardScreen.tsx",
  );
  assert.match(storyboard, /<SelectContent>/);
  assert.match(storyboard, /<SelectItem value="NEEDS_REVIEW">Needs review<\/SelectItem>/);
  assert.doesNotMatch(storyboard, /<select[\s>]/);
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

test("compose only uses strict file mounts for files that still exist at runtime", () => {
  const compose = source("docker-compose.yml");
  assert.equal((compose.match(/create_host_path: false/g) ?? []).length, 1);
  assert.match(compose, /source: \$\{GCP_SERVICE_ACCOUNT_FILE:[^\n]+\}[\s\S]*?create_host_path: false/);
  assert.doesNotMatch(compose, /VIENEU_REFERENCE_AUDIO_FILE/);
  assert.doesNotMatch(compose, /\/run\/narrativex\/voices\/reference\.wav/);
});

test("local quality gate includes backend verify and worker static analysis", () => {
  const verification = source("scripts", "verify-local.py");
  assert.match(verification, /Step\("Backend verify", backend, \[mvnw, "verify"\]\)/);
  assert.match(verification, /"ruff", "check", "src", "tests"/);
  assert.match(verification, /"mypy", "src"/);
});

test("desktop renderer keeps Node isolation while disabling Chromium sandbox", () => {
  const main = source("app", "desktop", "src", "main", "main.ts");
  assert.match(main, /contextIsolation: true/);
  assert.match(main, /nodeIntegration: false/);
  assert.match(main, /sandbox: false/);
});

test("desktop removes the native application menu", () => {
  const main = source("app", "desktop", "src", "main", "main.ts");
  assert.match(main, /import \{[^}]*\bMenu\b[^}]*\} from "electron"/s);
  assert.match(main, /Menu\.setApplicationMenu\(null\)/);
});
