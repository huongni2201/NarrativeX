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

test("changing settings does not replace a lane pool while requests are active", async () => {
  const root = await mkdtemp(join(tmpdir(), "nx-gemini-resize-"));
  let characterTabs = 2;
  let releaseFirst;
  const firstGate = new Promise((resolve) => {
    releaseFirst = resolve;
  });
  const roots = [];
  const pool = new GeminiWebAutomationPool(
    root,
    async () => ({ characterTabs, storyboardTabs: 4 }),
    (slotRoot) => {
      roots.push(slotRoot);
      return {
        async generateImage(_lane, prompt) {
          if (slotRoot === root) {
            await writeFile(join(root, "session.json"), JSON.stringify({ port: 9444 }));
          }
          if (prompt === "first") await firstGate;
          return { sourcePath: slotRoot, captureMethod: "DOWNLOAD" };
        },
        async stop() {},
      };
    },
  );

  const first = pool.generateImage("CHARACTER", "first");
  await new Promise((resolve) => setTimeout(resolve, 10));
  characterTabs = 6;
  const second = pool.generateImage("CHARACTER", "second");
  await second;
  releaseFirst();
  await first;

  assert.equal(roots.filter((value) => value.includes("slots/character")).length, 1);

  await Promise.all([
    pool.generateImage("CHARACTER", "after-a"),
    pool.generateImage("CHARACTER", "after-b"),
    pool.generateImage("CHARACTER", "after-c"),
  ]);
  assert.ok(roots.some((value) => value.includes("slots/character/2")));
});
