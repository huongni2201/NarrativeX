import test from "node:test";
import assert from "node:assert/strict";
import {
  imageExtensionForMimeType,
  isGeminiDownloadRecoveryError,
} from "../src/main/gemini-web/gemini-web-download-recovery.ts";

test("Gemini download recovery recognizes the fragile-control failures", () => {
  const controlError = new Error(
    "[GEMINI_DOWNLOAD_CONTROL_NOT_FOUND] The generated image is visible.",
  );
  controlError.name = "GEMINI_DOWNLOAD_CONTROL_NOT_FOUND";
  assert.equal(isGeminiDownloadRecoveryError(controlError), true);

  const downloadError = new Error(
    "[GEMINI_DOWNLOAD_FAILED] Gemini finished, but the generated image was not downloaded.",
  );
  downloadError.name = "GEMINI_DOWNLOAD_FAILED";
  assert.equal(isGeminiDownloadRecoveryError(downloadError), true);

  assert.equal(isGeminiDownloadRecoveryError(new Error("GEMINI_GENERATION_REJECTED")), false);
});

test("recovered image mime types map to supported project extensions", () => {
  assert.equal(imageExtensionForMimeType("image/png"), ".png");
  assert.equal(imageExtensionForMimeType("image/jpeg; charset=binary"), ".jpg");
  assert.equal(imageExtensionForMimeType("image/webp"), ".webp");
  assert.equal(imageExtensionForMimeType("image/gif"), null);
  assert.equal(imageExtensionForMimeType(null), null);
});
