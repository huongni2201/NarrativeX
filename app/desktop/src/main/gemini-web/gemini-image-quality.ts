import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

export type GeminiImageMetadata = {
  width: number;
  height: number;
  aspectRatio: number;
  sha256: string;
  byteLength: number;
  format: "PNG" | "JPEG" | "WEBP";
};

export async function inspectGeminiImage(path: string): Promise<GeminiImageMetadata> {
  const bytes = await readFile(path);
  const dimensions = readDimensions(bytes);
  if (!dimensions || dimensions.width <= 0 || dimensions.height <= 0) {
    throw new Error("Gemini image could not be decoded well enough to determine dimensions.");
  }
  return {
    ...dimensions,
    aspectRatio: dimensions.width / dimensions.height,
    sha256: createHash("sha256").update(bytes).digest("hex"),
    byteLength: bytes.length,
  };
}

export function validateGeneratedGeminiImage(
  metadata: GeminiImageMetadata,
  options: { minimumWidth?: number; minimumHeight?: number; expectedAspectRatio?: number } = {},
): void {
  const minimumWidth = options.minimumWidth ?? 1280;
  const minimumHeight = options.minimumHeight ?? 720;
  if (metadata.width < minimumWidth || metadata.height < minimumHeight) {
    throw new Error(
      `Gemini image resolution ${metadata.width}x${metadata.height} is below ${minimumWidth}x${minimumHeight}.`,
    );
  }
  if (options.expectedAspectRatio) {
    const relativeError = Math.abs(metadata.aspectRatio - options.expectedAspectRatio) / options.expectedAspectRatio;
    if (relativeError > 0.08) {
      throw new Error("Gemini image aspect ratio does not match the requested frame closely enough.");
    }
  }
}

export function validateCleanedVariant(
  original: GeminiImageMetadata,
  cleaned: GeminiImageMetadata,
): void {
  if (cleaned.width !== original.width || cleaned.height !== original.height) {
    throw new Error(
      `Watermark removal changed image dimensions from ${original.width}x${original.height} to ${cleaned.width}x${cleaned.height}.`,
    );
  }
  if (Math.abs(cleaned.aspectRatio - original.aspectRatio) > 0.001) {
    throw new Error("Watermark removal changed the image aspect ratio.");
  }
  if (cleaned.byteLength <= 0) {
    throw new Error("Watermark removal produced an empty image.");
  }
}

function readDimensions(
  bytes: Buffer,
): Pick<GeminiImageMetadata, "width" | "height" | "format"> | null {
  if (
    bytes.length >= 24 &&
    bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  ) {
    return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20), format: "PNG" };
  }
  if (bytes.length >= 12 && bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP") {
    const chunk = bytes.toString("ascii", 12, 16);
    if (chunk === "VP8X" && bytes.length >= 30) {
      return {
        width: 1 + bytes.readUIntLE(24, 3),
        height: 1 + bytes.readUIntLE(27, 3),
        format: "WEBP",
      };
    }
  }
  if (bytes.length >= 4 && bytes[0] === 0xff && bytes[1] === 0xd8) {
    let offset = 2;
    while (offset + 9 < bytes.length) {
      if (bytes[offset] !== 0xff) {
        offset++;
        continue;
      }
      const marker = bytes[offset + 1];
      if (marker === 0xd8 || marker === 0xd9) {
        offset += 2;
        continue;
      }
      const length = bytes.readUInt16BE(offset + 2);
      if (length < 2 || offset + 2 + length > bytes.length) break;
      if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) {
        return {
          height: bytes.readUInt16BE(offset + 5),
          width: bytes.readUInt16BE(offset + 7),
          format: "JPEG",
        };
      }
      offset += 2 + length;
    }
  }
  return null;
}
