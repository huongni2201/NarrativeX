import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const automationSource = await readFile(
  new URL("../src/main/gemini-web/gemini-web-automation.ts", import.meta.url),
  "utf8",
);

test("Gemini Chrome stays active while its window is minimized or occluded", () => {
  for (const flag of [
    "--disable-background-timer-throttling",
    "--disable-renderer-backgrounding",
    "--disable-backgrounding-occluded-windows",
    "--disable-features=CalculateNativeWinOcclusion",
  ]) {
    assert.match(automationSource, new RegExp(`['\"]${flag}['\"]`));
  }
});

test("Gemini Chrome starts minimized so its taskbar icon remains available", () => {
  assert.match(automationSource, /[\'\"]--start-minimized[\'\"]/);
});

test("Gemini brings its CDP page to the foreground before sending the prompt", () => {
  const submitIndex = automationSource.indexOf("await this.submitPrompt(cdp, normalizedPrompt)");
  const bringToFrontIndex = automationSource.lastIndexOf("Page.bringToFront", submitIndex);
  assert.ok(bringToFrontIndex >= 0);
  assert.ok(bringToFrontIndex < submitIndex);
});
