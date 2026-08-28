import assert from "node:assert/strict";
import test from "node:test";
import { hasCompletedGeminiGeneration } from "../src/main/gemini-web/gemini-web-generation-state.ts";

test("a late image in an old Gemini response does not complete the current generation", () => {
  assert.equal(
    hasCompletedGeminiGeneration(
      { generatedImageCount: 3, imageSources: ["blob:old-output", "", "blob:third-output"] },
      {
        generatedImageCount: 3,
        imageSources: ["blob:old-output", "blob:late-old-output", "blob:third-output"],
      },
    ),
    false,
  );
});

test("a loaded image in a newly added Gemini response completes the current generation", () => {
  assert.equal(
    hasCompletedGeminiGeneration(
      { generatedImageCount: 3, imageSources: ["blob:old-output", "", "blob:third-output"] },
      {
        generatedImageCount: 4,
        imageSources: [
          "blob:old-output",
          "blob:late-old-output",
          "blob:third-output",
          "blob:new-output",
        ],
      },
    ),
    true,
  );
});

test("a new Gemini response is not complete until its image source is loaded", () => {
  assert.equal(
    hasCompletedGeminiGeneration(
      { generatedImageCount: 3, imageSources: ["blob:old-output", "", "blob:third-output"] },
      {
        generatedImageCount: 4,
        imageSources: [
          "blob:old-output",
          "blob:late-old-output",
          "blob:third-output",
          "",
        ],
      },
    ),
    false,
  );
});
