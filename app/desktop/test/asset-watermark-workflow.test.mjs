import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { installGeminiWatermarkAssetVariants } from "../src/main/gemini-web/gemini-watermark-asset-variants.ts";
import { ALL_ASSET_CHAPTERS, filterAssetsByChapter } from "../src/renderer/features/assets/model/asset-chapter-filter.ts";

test("cleaned Gemini variant preserves canonical bytes and becomes preferred", async () => {
  const root = await mkdtemp(join(tmpdir(), "narrativex-watermark-"));
  const projectId = "00000000-0000-4000-8000-000000000001";
  const assetId = "asset-1";
  const projectDirectory = join(root, projectId);
  const canonicalPath = join(projectDirectory, "assets", "images", `${assetId}.png`);
  const cleanedPath = join(root, "cleaned.png");
  await mkdir(join(projectDirectory, "assets", "images"), { recursive: true });
  await writeFile(canonicalPath, "original-watermarked");
  await writeFile(cleanedPath, "cleaned-image");
  const storage = { projectDirectory: () => projectDirectory, resolveAsset: async () => canonicalPath };
  const variants = installGeminiWatermarkAssetVariants(storage);
  try {
    await variants.markGeminiAsset(projectId, assetId);
    assert.deepEqual(await variants.watermarkStates(projectId, [assetId]), { [assetId]: "PENDING" });
    await variants.registerRemovedVariant(projectId, assetId, cleanedPath);
    assert.equal(await readFile(canonicalPath, "utf8"), "original-watermarked");
    const preferred = await storage.resolveAsset(projectId, assetId);
    assert.equal(await readFile(preferred, "utf8"), "cleaned-image");
    assert.deepEqual(await variants.watermarkStates(projectId, [assetId]), { [assetId]: "REMOVED" });
    assert.equal(createHash("sha256").update(await readFile(canonicalPath)).digest("hex"), createHash("sha256").update("original-watermarked").digest("hex"));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("chapter filter includes visual media and chapter narration", () => {
  const assets = [{ id: "visual-a" }, { id: "visual-b" }, { id: "audio-a" }, { id: "other" }];
  const timeline = {
    beats: [
      { chapterId: "chapter-a", mediaAssetId: "visual-a" },
      { chapterId: "chapter-b", mediaAssetId: "visual-b" },
    ],
    chapters: [{ chapterId: "chapter-a", narrationAssetId: "audio-a" }],
  };
  assert.deepEqual(filterAssetsByChapter(assets, timeline, ALL_ASSET_CHAPTERS), assets);
  assert.deepEqual(filterAssetsByChapter(assets, timeline, "chapter-a").map((asset) => asset.id), ["visual-a", "audio-a"]);
});
