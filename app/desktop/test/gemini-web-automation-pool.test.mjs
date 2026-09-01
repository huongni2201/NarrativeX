import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { GeminiWebAutomationPool } from "../src/main/gemini-web/gemini-web-automation-pool.ts";

test("Gemini automation pool runs Character requests up to configured concurrency", async () => {
  const root = await mkdtemp(join(tmpdir(), "nx-gemini-pool-"));
  let active = 0;
  let maxActive = 0;
  const roots = [];
  const pool = new GeminiWebAutomationPool(
    root,
    async () => ({ characterTabs: 2, storyboardTabs: 4 }),
    (slotRoot) => {
      roots.push(slotRoot);
      return {
        async generateImage() {
          active += 1;
          maxActive = Math.max(maxActive, active);
          if (slotRoot === root) {
            await writeFile(join(root, "session.json"), JSON.stringify({ port: 9222 }));
          }
          await new Promise((resolve) => setTimeout(resolve, 20));
          active -= 1;
          return { sourcePath: slotRoot, captureMethod: "DOWNLOAD" };
        },
        async stop() {},
      };
    },
  );

  await Promise.all([
    pool.generateImage("CHARACTER", "a"),
    pool.generateImage("CHARACTER", "b"),
    pool.generateImage("CHARACTER", "c"),
  ]);

  assert.equal(maxActive, 2);
  assert.ok(roots.some((value) => value.includes("slots")));
  const secondarySession = JSON.parse(
    await readFile(join(root, "slots", "character", "1", "session.json"), "utf8"),
  );
  assert.equal(secondarySession.port, 9222);
});

test("Gemini automation pool keeps Character and Storyboard capacities independent", async () => {
  const root = await mkdtemp(join(tmpdir(), "nx-gemini-lanes-"));
  const pool = new GeminiWebAutomationPool(
    root,
    async () => ({ characterTabs: 2, storyboardTabs: 4 }),
    (slotRoot) => ({
      async generateImage(lane) {
        if (slotRoot === root) {
          await writeFile(join(root, "session.json"), JSON.stringify({ port: 9333 }));
        }
        return { sourcePath: `${lane}:${slotRoot}`, captureMethod: "DOWNLOAD" };
      },
      async stop() {},
    }),
  );

  const results = await Promise.all([
    pool.generateImage("CHARACTER", "a"),
    pool.generateImage("STORYBOARD", "b"),
  ]);
  assert.match(results[0].sourcePath, /^CHARACTER:/);
  assert.match(results[1].sourcePath, /^STORYBOARD:/);
});
