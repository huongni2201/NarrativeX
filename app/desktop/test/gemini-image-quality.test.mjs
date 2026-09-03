import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  inspectGeminiImage,
  validateCleanedVariant,
  validateGeneratedGeminiImage,
} from "../src/main/gemini-web/gemini-image-quality.ts";

function pngHeader(width, height) {
  const bytes = Buffer.alloc(24);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(bytes, 0);
  bytes.write("IHDR", 12, "ascii");
  bytes.writeUInt32BE(width, 16);
  bytes.writeUInt32BE(height, 20);
  return bytes;
}

test("inspects PNG dimensions and checksum without image-processing dependencies", async () => {
  const directory = await mkdtemp(join(tmpdir(), "narrativex-image-quality-"));
  const path = join(directory, "frame.png");
  try {
    await writeFile(path, pngHeader(2560, 1440));
    const metadata = await inspectGeminiImage(path);
    assert.equal(metadata.width, 2560);
    assert.equal(metadata.height, 1440);
    assert.equal(metadata.format, "PNG");
    assert.equal(metadata.sha256.length, 64);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("rejects thumbnail-sized generated images", () => {
  assert.throws(
    () =>
      validateGeneratedGeminiImage({
        width: 640,
        height: 360,
        aspectRatio: 16 / 9,
        sha256: "a".repeat(64),
        byteLength: 1000,
        format: "PNG",
      }),
    /below 1280x720/,
  );
});

test("rejects cleaned variants that change source dimensions", () => {
  const original = {
    width: 2560,
    height: 1440,
    aspectRatio: 16 / 9,
    sha256: "a".repeat(64),
    byteLength: 5000,
    format: "PNG",
  };
  assert.throws(
    () => validateCleanedVariant(original, { ...original, width: 1920, sha256: "b".repeat(64) }),
    /changed image dimensions/,
  );
});
