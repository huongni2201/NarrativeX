import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(
  new URL("../src/renderer/features/production/useRenderController.ts", import.meta.url),
  "utf8",
);

test("failed artifact delivery keeps the destination token and resets the in-flight guard", () => {
  assert.doesNotMatch(source, /const token = destinationToken;\s*setDestinationToken\(null\);/s);
  assert.match(source, /\.then\(\(\{ path \}\) => \{[\s\S]*setDestinationToken\(null\)/);
  assert.match(source, /\.catch\(\(error: unknown\) => \{[\s\S]*deliveringJobRef\.current = null/);
});
