import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("preload SSE subscription IDs satisfy main-process validation", () => {
  const preloadSource = readFileSync(
    new URL("../src/preload/index.ts", import.meta.url),
    "utf8",
  );
  const mainSource = readFileSync(
    new URL("../src/main/api/backend-sse-ipc.ts", import.meta.url),
    "utf8",
  );

  assert.match(preloadSource, /crypto\.randomUUID\(\)/);
  assert.match(mainSource, /const SUBSCRIPTION_ID = \/\^\[0-9a-f-\]\{36\}\$\/iu/);
});
