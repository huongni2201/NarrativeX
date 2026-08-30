import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const postprocessorSource = await readFile(
  new URL("../src/main/gemini-web/gemini-image-postprocessor.ts", import.meta.url),
  "utf8",
).catch(() => "");

const ipcSource = await readFile(
  new URL("../src/main/gemini-web/gemini-web-ipc.ts", import.meta.url),
  "utf8",
);

test("Gemini images are postprocessed with the watermark remover in a hidden child process", () => {
  assert.match(postprocessorSource, /@pilio\/gemini-watermark-remover/);
  assert.match(postprocessorSource, /["']remove["']/);
  assert.match(postprocessorSource, /["']--output["']/);
  assert.match(postprocessorSource, /windowsHide:\s*true/);
});

test("Windows launches pnpm.cmd through cmd.exe instead of spawning the .cmd file directly", () => {
  assert.match(postprocessorSource, /process\.env\.ComSpec/);
  assert.match(postprocessorSource, /["']cmd\.exe["']/);
  assert.match(postprocessorSource, /["']\/d["']/);
  assert.match(postprocessorSource, /["']\/s["']/);
  assert.match(postprocessorSource, /["']\/c["']/);
});

test("Gemini generation stages only the postprocessed image", () => {
  const generateIndex = ipcSource.indexOf("await automation.generateImage");
  const postprocessIndex = ipcSource.indexOf("await removeGeminiWatermark", generateIndex);
  const stageIndex = ipcSource.indexOf("stageGeneratedImage", postprocessIndex);

  assert.ok(generateIndex >= 0);
  assert.ok(postprocessIndex > generateIndex);
  assert.ok(stageIndex > postprocessIndex);
});

test("Gemini temporary processed image is cleaned after project asset registration", () => {
  const registerIndex = ipcSource.indexOf("await projectStorage.registerAsset");
  const cleanupIndex = ipcSource.indexOf("await cleanupGeminiTempFile", registerIndex);

  assert.ok(registerIndex >= 0);
  assert.ok(cleanupIndex > registerIndex);
});
