import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import test from "node:test";

const desktopRoot = resolve(dirname(import.meta.filename), "..");
const rendererRoot = join(desktopRoot, "src", "renderer");

test("renderer entrypoint uses the canonical app boundary directly", () => {
  assert.equal(
    existsSync(join(rendererRoot, "App.tsx")),
    false,
    "renderer/App.tsx compatibility facade must not be restored",
  );

  const source = readFileSync(join(rendererRoot, "main.tsx"), "utf8");
  assert.match(source, /import\s+\{\s*DesktopApp\s*\}\s+from\s+["']\.\/app\/DesktopApp["']/);
  assert.match(source, /<DesktopApp\s*\/>/);
  assert.doesNotMatch(source, /import\s+\{\s*App\s*\}\s+from\s+["']\.\/App["']/);
});

test("pure renderer model helpers do not remain at feature roots", () => {
  const misplaced = [
    "features/voices/voice-filters.ts",
    "features/generation/generation-status.ts",
    "features/generation/media-review-policy.ts",
    "features/storyboard/storyboard-review.ts",
    "features/editor/editor-mutation-state.ts",
    "features/editor/editor-timeline.ts",
    "features/editor/preview-playback.ts",
    "features/production/auto-edit-planner.ts",
    "features/production/command-history.ts",
    "features/production/timeline-commands.ts",
    "features/production/timeline-draft.ts",
  ];

  assert.deepEqual(
    misplaced.filter((path) => existsSync(join(rendererRoot, path))),
    [],
    "pure feature model logic belongs under model/; obsolete model helpers should be deleted",
  );
});
