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
