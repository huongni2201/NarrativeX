import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

async function source(path) {
  return readFile(new URL(path, import.meta.url), "utf8");
}

test("RenderScreen selects a destination and starts from the returned selection", async () => {
  const screen = await source("../src/renderer/features/production/screens/RenderScreen.tsx");
  const controller = await source("../src/renderer/features/production/useRenderController.ts");

  assert.match(screen, /controller\.chooseDestinationAndStartRender\(\)/);
  assert.match(controller, /async function chooseDestinationAndStartRender\(\)/);
  assert.match(controller, /startRender\(destination\)/);
});

test("render delivery is bound to a job before the one-shot selection token expires", async () => {
  const mainIpc = await source("../src/main/local-storage/project-catalog-ipc.ts");
  const preload = await source("../src/preload/index.ts");

  assert.match(mainIpc, /desktop:render:bind-destination/);
  assert.match(preload, /desktop:render:bind-destination/);
  assert.doesNotMatch(
    mainIpc,
    /desktop:render:deliver-artifact[\s\S]*pendingRenderDestinations\.consume\(/,
  );
});

test("project workspace owns one render controller across editor and render routes", async () => {
  const route = await source("../src/renderer/features/editor/ProjectWorkspaceRoute.tsx");
  const editor = await source("../src/renderer/features/editor/EditorScreen.tsx");
  const render = await source("../src/renderer/features/production/screens/RenderScreen.tsx");

  assert.match(route, /const renderController = useRenderController\(/);
  assert.match(route, /<EditorScreen[^>]*renderController=\{renderController\}/s);
  assert.match(route, /<RenderScreen[^>]*controller=\{renderController\}/s);
  assert.doesNotMatch(editor, /const renderController = useRenderController\(/);
  assert.doesNotMatch(render, /const controller = useRenderController\(/);
});

test("local execution invalidates pending claims and retries initial transient heartbeat failures", async () => {
  const service = await source("../src/main/local-execution/service.ts");

  assert.match(service, /sessionEpoch/);
  assert.match(service, /claimEpoch/);
  assert.match(service, /scheduleHeartbeatRetry/);
  assert.match(service, /heartbeatRetryAttempt/);
});
