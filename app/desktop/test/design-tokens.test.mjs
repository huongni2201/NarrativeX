import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, extname, join, resolve } from "node:path";
import test from "node:test";

const desktopRoot = resolve(dirname(import.meta.filename), "..");
const rendererRoot = join(desktopRoot, "src", "renderer");
const stylesPath = join(rendererRoot, "styles.css");

function sourceFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return [".ts", ".tsx"].includes(extname(entry.name)) ? [path] : [];
  });
}

test("renderer CSS variable references resolve to declared design tokens", () => {
  const styles = readFileSync(stylesPath, "utf8");
  const declarations = new Set(
    [...styles.matchAll(/^\s*(--[a-z0-9-]+)\s*:/gim)].map(([, token]) => token),
  );
  const files = [
    join(rendererRoot, "features", "editor", "ProjectWorkspaceRoute.tsx"),
    ...sourceFiles(join(rendererRoot, "components", "ui")),
  ];
  const unresolved = new Set();

  for (const file of files) {
    const source = readFileSync(file, "utf8");
    for (const [, token] of source.matchAll(/var\((--[a-z0-9-]+)/gim)) {
      if (!token.startsWith("--radix-") && !declarations.has(token)) {
        unresolved.add(token);
      }
    }
  }

  assert.deepEqual(
    [...unresolved].sort(),
    [],
    `Undefined renderer design tokens: ${[...unresolved].sort().join(", ")}`,
  );
});
