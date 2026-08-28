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

test("Gemini menu text alone does not mark image mode as active", () => {
  assert.doesNotMatch(
    automationSource,
    /text\.includes\("tạo hình ảnh"\)\s*\|\|\s*text\.includes\("create image"\)/,
  );
});

test("Gemini explicitly clicks create-image after opening the tools menu", () => {
  assert.match(automationSource, /clickCreateImageAction/);
  assert.match(automationSource, /waitForImageModeReady/);
  assert.match(
    automationSource,
    /openImageModeMenu\(cdp\)[\s\S]*clickCreateImageAction\(cdp\)[\s\S]*waitForImageModeReady\(cdp/,
  );
});
