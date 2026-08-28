import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const preload = readFileSync(resolve(root, "src/preload/index.ts"), "utf8");
const rendererHtml = readFileSync(resolve(root, "src/renderer/index.html"), "utf8");

test("preload does not depend on unrestricted Node core modules", () => {
  assert.doesNotMatch(preload, /from\s+["']node:/);
});

test("pending desktop auth callback consumption handles IPC rejection", () => {
  assert.match(
    preload,
    /\.invoke\("desktop:auth:consume-pending"\)[\s\S]*?\.catch\(\(\)\s*=>\s*undefined\)/,
  );
});

test("renderer defines a restrictive content security policy", () => {
  assert.match(rendererHtml, /http-equiv="Content-Security-Policy"/i);
  assert.match(rendererHtml, /script-src 'self'/);
  assert.match(rendererHtml, /object-src 'none'/);
  assert.match(rendererHtml, /base-uri 'none'/);
  assert.match(rendererHtml, /narrativex-media:/);
});

test("renderer allows loopback backend URLs for local media playback", () => {
  const mediaSrc = rendererHtml.match(/media-src[^;]+;/)?.[0] ?? "";
  assert.match(mediaSrc, /http:\/\/localhost:\*/);
  assert.match(mediaSrc, /http:\/\/127\.0\.0\.1:\*/);
  assert.doesNotMatch(mediaSrc, /\shttp:\s/);
});
