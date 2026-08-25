import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import test from "node:test";

const desktopRoot = resolve(dirname(import.meta.filename), "..");
const rendererRoot = join(desktopRoot, "src", "renderer");

test("renderer local asset references resolve to files in public", () => {
  const sourceFiles = [
    join(rendererRoot, "index.html"),
    join(rendererRoot, "features", "auth", "components", "LoginScreen.tsx"),
    join(rendererRoot, "features", "editor", "EditorScreen.tsx"),
  ];
  const assetReferences = sourceFiles.flatMap((sourceFile) =>
    [...readFileSync(sourceFile, "utf8").matchAll(/(?:src|href)=['"](\/[^'"]+)['"]/g)].map(
      ([, reference]) => reference,
    ),
  );

  for (const reference of assetReferences) {
    assert.ok(
      existsSync(join(rendererRoot, "public", reference.slice(1))),
      `${reference} must exist in renderer/public`,
    );
  }
});
