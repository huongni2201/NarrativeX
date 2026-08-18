import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

const result = spawnSync(process.execPath, ["scripts/check-architecture.mjs"], {
  cwd: process.cwd(),
  encoding: "utf8",
});

test("frontend architecture rules pass", () => {
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  assert.match(result.stdout, /Frontend architecture check passed/);
});
