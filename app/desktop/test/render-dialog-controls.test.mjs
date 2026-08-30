import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const dialogSource = await readFile(
  new URL("../src/renderer/features/production/components/RenderDialog.tsx", import.meta.url),
  "utf8",
);
const controllerSource = await readFile(
  new URL("../src/renderer/features/production/useRenderController.ts", import.meta.url),
  "utf8",
);
const apiSource = await readFile(
  new URL("../src/renderer/features/production/api/production.api.ts", import.meta.url),
  "utf8",
);

test("render destination can be selected before the timeline is render-ready", () => {
  assert.match(controllerSource, /async function chooseDestination\(\)/);
  assert.match(controllerSource, /window\.narrativex\.render\.chooseDestination\(\)/);
  assert.match(dialogSource, /onClick=\{\(\) => void controller\.chooseDestination\(\)\}/);

  const startRender = controllerSource.slice(
    controllerSource.indexOf("async function startRender()"),
    controllerSource.indexOf("return {", controllerSource.indexOf("async function startRender()")),
  );
  assert.doesNotMatch(startRender, /\.chooseDestination\(\)/);
});

test("subtitle control is a real toggle and defaults to enabled", () => {
  assert.match(
    controllerSource,
    /const \[subtitlesEnabled, setSubtitlesEnabled\] = useState\(true\)/,
  );
  assert.match(dialogSource, /aria-pressed=\{controller\.subtitlesEnabled\}/);
  assert.match(
    dialogSource,
    /controller\.setSubtitlesEnabled\(!controller\.subtitlesEnabled\)/,
  );
});

test("render request sends the subtitle setting", () => {
  assert.match(apiSource, /subtitlesEnabled/);
  assert.match(apiSource, /body:\s*JSON\.stringify\(\{[\s\S]*subtitlesEnabled/);
});
