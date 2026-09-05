import test from "node:test";
import assert from "node:assert/strict";
import {
  imageExtensionForMimeType,
  selectBestNetworkCandidate,
} from "../src/main/gemini-web/gemini-web-network-capture.ts";

test("Gemini network capture maps supported image mime types", () => {
  assert.equal(imageExtensionForMimeType("image/png"), ".png");
  assert.equal(imageExtensionForMimeType("image/jpeg; charset=binary"), ".jpg");
  assert.equal(imageExtensionForMimeType("image/webp"), ".webp");
  assert.equal(imageExtensionForMimeType("image/svg+xml"), null);
});

test("Gemini network capture prefers the response that matches the fresh DOM image", () => {
  const startedAt = Date.now() - 1_000;
  const common = {
    mimeType: "image/png",
    encodedDataLength: 300_000,
    seenAt: Date.now() - 500,
    finishedAt: Date.now() - 100,
  };
  const candidates = [
    {
      ...common,
      requestId: "avatar",
      url: "https://lh3.googleusercontent.com/avatar.png",
      encodedDataLength: 500_000,
    },
    {
      ...common,
      requestId: "generated",
      url: "https://lh3.googleusercontent.com/generated.png?token=abc",
    },
  ];

  const selected = selectBestNetworkCandidate(
    candidates,
    [{ src: "https://lh3.googleusercontent.com/generated.png?token=abc", area: 1024 * 1024 }],
    startedAt,
  );

  assert.equal(selected?.requestId, "generated");
});

test("Gemini network capture accepts a small response when it matches the fresh DOM image", () => {
  const startedAt = Date.now() - 1_000;
  const selected = selectBestNetworkCandidate(
    [
      {
        requestId: "small-generated",
        url: "https://lh3.googleusercontent.com/generated.png?token=small",
        mimeType: "image/png",
        encodedDataLength: 8 * 1024,
        seenAt: Date.now() - 500,
        finishedAt: Date.now() - 100,
      },
    ],
    [{ src: "https://lh3.googleusercontent.com/generated.png?token=small", area: 1024 * 1024 }],
    startedAt,
  );

  assert.equal(selected?.requestId, "small-generated");
});

test("Gemini network capture rejects unrelated network images without a fresh DOM correlation", () => {
  const startedAt = Date.now() - 1_000;
  const selected = selectBestNetworkCandidate(
    [
      {
        requestId: "unrelated",
        url: "https://example.com/banner.png",
        mimeType: "image/png",
        encodedDataLength: 800_000,
        seenAt: Date.now() - 500,
        finishedAt: Date.now() - 100,
      },
    ],
    [],
    startedAt,
  );

  assert.equal(selected, null);
});
