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

function webpVp8Header(width, height) {
  const bytes = Buffer.alloc(30);
  bytes.write("RIFF", 0, "ascii");
  bytes.writeUInt32LE(22, 4);
  bytes.write("WEBP", 8, "ascii");
  bytes.write("VP8 ", 12, "ascii");
  bytes.writeUInt32LE(10, 16);
  bytes[23] = 0x9d;
  bytes[24] = 0x01;
  bytes[25] = 0x2a;
  bytes.writeUInt16LE(width, 26);
  bytes.writeUInt16LE(height, 28);
  return bytes;
}

function webpVp8lHeader(width, height) {
  const bytes = Buffer.alloc(25);
  bytes.write("RIFF", 0, "ascii");
  bytes.writeUInt32LE(17, 4);
  bytes.write("WEBP", 8, "ascii");
  bytes.write("VP8L", 12, "ascii");
  bytes.writeUInt32LE(5, 16);
  bytes[20] = 0x2f;
  const encodedWidth = width - 1;
  const encodedHeight = height - 1;
  bytes[21] = encodedWidth & 0xff;
  bytes[22] = ((encodedWidth >>> 8) & 0x3f) | ((encodedHeight & 0x03) << 6);
  bytes[23] = (encodedHeight >>> 2) & 0xff;
  bytes[24] = (encodedHeight >>> 10) & 0x3f;
  return bytes;
}

test("inspects 2k PNG dimensions and checksum without image-processing dependencies", async () => {
  const directory = await mkdtemp(join(tmpdir(), "narrativex-image-quality-"));
  const path = join(directory, "frame.png");
  try {
    await writeFile(path, pngHeader(2560, 1440));
    const metadata = await inspectGeminiImage(path);
    assert.equal(metadata.width, 2560);
    assert.equal(metadata.height, 1440);
    assert.equal(metadata.format, "PNG");
    assert.equal(metadata.sha256.length, 64);
    validateGeneratedGeminiImage(metadata);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("inspects lossy WebP dimensions", async () => {
  const directory = await mkdtemp(join(tmpdir(), "narrativex-image-quality-"));
  const path = join(directory, "frame.webp");
  try {
    await writeFile(path, webpVp8Header(1024, 572));
    const metadata = await inspectGeminiImage(path);
    assert.equal(metadata.width, 1024);
    assert.equal(metadata.height, 572);
    assert.equal(metadata.format, "WEBP");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("inspects lossless WebP dimensions", async () => {
  const directory = await mkdtemp(join(tmpdir(), "narrativex-image-quality-"));
  const path = join(directory, "frame.webp");
  try {
    await writeFile(path, webpVp8lHeader(1024, 572));
    const metadata = await inspectGeminiImage(path);
    assert.equal(metadata.width, 1024);
    assert.equal(metadata.height, 572);
    assert.equal(metadata.format, "WEBP");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("accepts portrait 2k by long and short edges", () => {
  validateGeneratedGeminiImage({
    width: 1440,
    height: 2560,
    aspectRatio: 9 / 16,
    sha256: "a".repeat(64),
    byteLength: 1000,
    format: "PNG",
  });
});

test("accepts generated images below the 2k envelope with a warning", () => {
  const validation = validateGeneratedGeminiImage({
    width: 1920,
    height: 1080,
    aspectRatio: 16 / 9,
    sha256: "a".repeat(64),
    byteLength: 1000,
    format: "PNG",
  });

  assert.deepEqual(validation.warnings, ["LOW_RESOLUTION:1920x1080"]);
});

test("rejects generated images with invalid dimensions", () => {
  assert.throws(
    () =>
      validateGeneratedGeminiImage({
        width: 0,
        height: 1080,
        aspectRatio: 0,
        sha256: "a".repeat(64),
        byteLength: 1000,
        format: "PNG",
      }),
    /dimensions must be greater than zero/,
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
