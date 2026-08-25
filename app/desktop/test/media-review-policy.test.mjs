import test from "node:test";
import assert from "node:assert/strict";
import { diffPrompt, preserveUnaffectedReviews, reviewReadiness, selectedRegenerationIds } from "../src/renderer/features/generation/media-review-policy.ts";

const item = { id: "i1", visualBeatId: "b1", mediaAssetId: "a1", executionStatus: "COMPLETED", reviewStatus: "NEEDS_REVIEW", rowVersion: 3 };
const asset = { id: "a1", type: "IMAGE", origin: "GENERATED", originalFilename: "a.png", contentType: "image/png", sizeBytes: 100, status: "READY", createdAt: "now", durationMs: null, storageMode: "LOCAL_ONLY", sha256: "abc" };

test("approval requires verified local checksum identity", () => {
  assert.equal(reviewReadiness(item, asset, null).canApprove, false);
  assert.equal(reviewReadiness(item, asset, { assetId: "a1", state: "AVAILABLE", sizeBytes: 100, checksumSha256: "abc", confirmedAt: "now" }).canApprove, true);
  assert.equal(reviewReadiness(item, asset, { assetId: "a1", state: "AVAILABLE", sizeBytes: 100, checksumSha256: "wrong", confirmedAt: "now" }).canApprove, false);
});

test("regeneration scope contains selected known items only", () => {
  const items = [item, { ...item, id: "i2", reviewStatus: "APPROVED" }];
  assert.deepEqual(selectedRegenerationIds(items, new Set(["i2", "stale"])), ["i2"]);
  assert.deepEqual([...preserveUnaffectedReviews(items, new Set(["i1"]))], [["i2", "APPROVED"]]);
});

test("prompt diff is whitespace-normalized", () => {
  assert.deepEqual(diffPrompt(" cinematic ", "cinematic"), { changed: false, before: "cinematic", after: "cinematic" });
});
