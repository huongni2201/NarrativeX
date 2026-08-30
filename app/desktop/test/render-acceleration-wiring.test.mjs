import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import test from "node:test";

const desktopRoot = resolve(dirname(import.meta.filename), "..");

function source(path) {
  return readFileSync(join(desktopRoot, path), "utf8");
}

test("project renderer forwards runtime encoder and concurrency to segment rendering", () => {
  const renderer = source("src/main/rendering/project-renderer.ts");
  assert.match(renderer, /videoEncoder:\s*this\.runtime\.videoEncoder/);
  assert.match(renderer, /concurrency:\s*this\.runtime\.renderConcurrency/);
});

test("project renderer forwards runtime encoder to subtitle muxing", () => {
  const renderer = source("src/main/rendering/project-renderer.ts");
  assert.match(renderer, /subtitlePath,[\s\S]*?signal,[\s\S]*?this\.runtime\.videoEncoder/);
});

test("segment renderer uses a bounded worker pool and encoder-aware cache", () => {
  const renderer = source("src/main/rendering/segment-renderer.ts");
  assert.match(renderer, /Promise\.all\(Array\.from\(\{ length: concurrency \}, \(\) => worker\(\)\)\)/);
  assert.match(renderer, /segmentCacheKey\(manifest, beat, videoEncoder\)/);
  assert.match(renderer, /rendererVersion: "segment-render-v5"/);
  assert.match(renderer, /failureController\.abort/);
});

test("audio muxer passes the selected encoder to mux argument construction", () => {
  const muxer = source("src/main/rendering/audio-muxer.ts");
  assert.match(muxer, /videoEncoder[\s\S]*?buildMuxNarrationArgs\([^)]*videoEncoder/s);
});
