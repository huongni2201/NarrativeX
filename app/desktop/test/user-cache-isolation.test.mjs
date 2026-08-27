import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const authGuard = readFileSync(resolve(root, "src/renderer/features/auth/AuthGuard.tsx"), "utf8");
const workspaceQueries = readFileSync(
  resolve(root, "src/renderer/features/workspace/queries/useProjectWorkspace.ts"),
  "utf8",
);

test("auth identity changes remove account-scoped query data", () => {
  assert.match(authGuard, /queryClient\.removeQueries\(\{[\s\S]*?queryKey\[0\]\s*!==\s*["']auth["']/);
  assert.doesNotMatch(authGuard, /await\s+queryClient\.invalidateQueries\(\)/);
});

test("asset library cache key includes the current user identity", () => {
  assert.match(
    workspaceQueries,
    /\[\s*["']assets["']\s*,\s*["']library["']\s*,\s*userId\s*,\s*scope\s*\]/,
  );
  assert.match(workspaceQueries, /assetLibraryQueryKey\(currentUserId\s*\?\?\s*["']anonymous["']/);
  assert.match(workspaceQueries, /enabled:\s*enabled\s*&&\s*hasAssets\s*&&\s*Boolean\(currentUserId\)/);
});
