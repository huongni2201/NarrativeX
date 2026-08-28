import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const source = readFileSync(
  new URL("../src/main/gemini-web/gemini-web-automation.ts", import.meta.url),
  "utf8",
);

test("image mode readiness no longer relies on document.body text for create image", () => {
  assert.doesNotMatch(
    source,
    /text\.includes\("tạo hình ảnh"\)\s*\|\|\s*text\.includes\("create image"\)/,
  );
});

test("image mode clicks the explicit create-image action", () => {
  assert.match(source, /clickCreateImageAction/);
  assert.match(source, /waitForImageModeReady/);
});

test("Gemini image mode supports the compact Vietnamese Ảnh entry", () => {
  assert.match(source, /"ảnh"/);
});

test("Gemini image mode opens tools or menu before retrying hidden image actions", () => {
  assert.match(source, /"tools"/);
  assert.match(source, /"công cụ"/);
  assert.match(source, /"menu"/);
  assert.match(source, /openImageModeMenu/);
});

