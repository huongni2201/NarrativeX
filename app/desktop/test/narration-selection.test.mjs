import assert from "node:assert/strict";
import test from "node:test";
import { voiceSupportsSpeakingRate } from "../src/renderer/features/voices/model/voice-filters.ts";
import { narrationApi } from "../src/renderer/features/generation/api/narration.api.ts";

test("speaking rate follows catalog metadata and its provider default", () => {
  assert.equal(voiceSupportsSpeakingRate({ provider: "VIENEU", metadataJson: null }), true);
  assert.equal(voiceSupportsSpeakingRate({ provider: "VIENEU", metadataJson: '{"supportsSpeakingRate":false}' }), false);
  assert.equal(voiceSupportsSpeakingRate({ provider: "OTHER", metadataJson: '{"supportsSpeakingRate":true}' }), true);
  assert.equal(voiceSupportsSpeakingRate({ provider: "OTHER", metadataJson: '{broken' }), false);
  assert.equal(voiceSupportsSpeakingRate(null), false);
});

test("narration creation reuses an existing result unless regeneration is explicit", async () => {
  const requests = [];
  const previous = globalThis.window;
  globalThis.window = { narrativex: { api: { request: async input => {
    requests.push(input);
    return { status: 200, statusText: "OK", bodyText: JSON.stringify({ success: true, message: "OK", timestamp: new Date().toISOString(), data: { jobId: "job" } }) };
  } } } };
  try {
    await narrationApi.generate("project", { chapterId: "chapter", voiceId: "voice", speakingRate: 1.2, voiceReference: null });
    await narrationApi.generate("project", { chapterId: "chapter", voiceId: "voice", forceRegenerate: true });
    assert.equal(requests[0].path.endsWith("/narration-jobs"), true);
    assert.deepEqual(JSON.parse(requests[0].body), { voiceId: "voice", speakingRate: 1.2, voiceReference: null });
    assert.equal(requests[1].path.endsWith("?forceRegenerate=true"), true);
  } finally {
    globalThis.window = previous;
  }
});
