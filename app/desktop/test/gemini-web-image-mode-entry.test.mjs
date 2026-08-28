import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const automationSource = readFileSync(
  new URL("../src/main/gemini-web/gemini-web-automation.ts", import.meta.url),
  "utf8",
);

test("Gemini image mode supports the compact Vietnamese Ảnh entry", () => {
  assert.match(automationSource, /"ảnh"/);
});

test("Gemini image mode opens tools or menu before retrying hidden image actions", () => {
  assert.match(automationSource, /"tools"/);
  assert.match(automationSource, /"công cụ"/);
  assert.match(automationSource, /"menu"/);
  assert.match(automationSource, /openImageModeMenu/);
});
