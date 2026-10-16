import test from "node:test";
import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { StoryAnalysisService } from "../src/main/story-analysis/service.ts";

test("backend transport uses the current device identity after re-pair and rejects local unpair", async () => {
  const directory = await mkdtemp(join(tmpdir(), "nx-bootstrap-"));
  globalThis.storyAnalysisTestElectron = {
    app: { getPath: () => directory, on() {} }, safeStorage: {}, shell: {}, ipcMain: { handle() {} },
  };
  const electron = "data:text/javascript," + encodeURIComponent("export const { app, safeStorage, shell, ipcMain } = globalThis.storyAnalysisTestElectron;");
  const hooks = registerHooks({ resolve(specifier, context, nextResolve) {
    if (specifier === "electron") return { url: electron, shortCircuit: true };
    try { return nextResolve(specifier, context); }
    catch (error) {
      if (error.code === "ERR_MODULE_NOT_FOUND" && specifier.startsWith(".")) return nextResolve(`${specifier}.ts`, context);
      throw error;
    }
  } });
  const originalFetch = globalThis.fetch;
  const originalStart = StoryAnalysisService.prototype.start;
  let started;
  const startup = new Promise(resolve => { started = resolve; });
  StoryAnalysisService.prototype.start = () => { started(); };
  const tokens = [];
  globalThis.fetch = async (_url, options) => { tokens.push(options.headers["X-NX-Device-Token"]); return { status: 204 }; };
  try {
    const { registerStoryAnalysis } = await import("../src/main/story-analysis/bootstrap.ts");
    let identity = { deviceId: "A", deviceToken: "token-A" };
    const service = registerStoryAnalysis({}, "http://localhost:8080", {}, { load: async () => identity }, {});
    await startup;
    await service.dependencies.request("/first", {});
    identity = { deviceId: "B", deviceToken: "token-B" };
    await service.dependencies.request("/after-repair", {});
    identity = null;
    await assert.rejects(service.dependencies.request("/after-unpair", {}), /Local device must be connected/u);
    assert.deepEqual(tokens, ["token-A", "token-B"]);
  } finally {
    globalThis.fetch = originalFetch;
    StoryAnalysisService.prototype.start = originalStart;
    hooks.deregister();
    delete globalThis.storyAnalysisTestElectron;
    await rm(directory, { recursive: true, force: true, maxRetries: 3 });
  }
});
