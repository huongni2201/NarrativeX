import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import * as postprocessor from "../src/main/gemini-web/gemini-image-postprocessor.ts";

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

test("watermark remover installs sharp in the same dlx environment", () => {
  const createCommand = postprocessor.createWatermarkRemoverCommand;
  assert.equal(typeof createCommand, "function");
  if (typeof createCommand !== "function") return;

  assert.deepEqual(
    createCommand(
      "C:\\images\\generated image.png",
      "C:\\images\\clean image.png",
      "win32",
      "C:\\Windows\\System32\\cmd.exe",
    ),
    {
      command: "C:\\Windows\\System32\\cmd.exe",
      args: [
        "/d",
        "/s",
        "/c",
        "pnpm.cmd",
        "dlx",
        "--package",
        "sharp@0.35.4",
        "--package",
        "@pilio/gemini-watermark-remover@1.0.41",
        "gwr",
        "remove",
        "C:\\images\\generated image.png",
        "--output",
        "C:\\images\\clean image.png",
      ],
    },
  );
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
