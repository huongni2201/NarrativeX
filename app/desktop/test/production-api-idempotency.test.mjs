import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(
  new URL("../src/renderer/features/production/api/production.api.ts", import.meta.url),
  "utf8",
);

test("project render creation relies on the backend deterministic idempotency key", () => {
  assert.doesNotMatch(source, /Idempotency-Key/);
  assert.doesNotMatch(source, /crypto\.randomUUID\(\)/);
});
