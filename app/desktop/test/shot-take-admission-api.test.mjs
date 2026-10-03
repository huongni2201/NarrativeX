import test from "node:test";
import assert from "node:assert/strict";
import { videoProductionApi } from "../src/renderer/features/production/api/video-production.api.ts";

test("shot admission preserves Idempotency-Key across transport retries and creates a new key for regenerate", async () => {
  const previous = globalThis.window;
  const requests = [];
  globalThis.window = { narrativex: { api: { request: async (input) => {
    requests.push(input);
    if (requests.length === 1) throw new Error("lost acknowledgement");
    return { status: 202, statusText: "Accepted", bodyText: JSON.stringify({
      success: true, message: "Queued", timestamp: "2026-10-03T00:00:00Z",
      data: { id: "take-1", generationJobId: "job-1", status: "PENDING" },
    }) };
  } } } };
  try {
    const input = { seed: 123, audioMode: "LTX_NATIVE_AV" };
    await assert.rejects(() => videoProductionApi.generateTake("project", "shot", input), /lost acknowledgement/);
    const response = await videoProductionApi.generateTake("project", "shot", input);
    await videoProductionApi.generateTake("project", "shot", { seed: 123 });
    const keys = requests.map((r) => r.headers["idempotency-key"]);
    assert.ok(keys[0]); assert.equal(keys[0], keys[1]); assert.notEqual(keys[1], keys[2]);
    assert.deepEqual(JSON.parse(requests[1].body), { seed: 123, audioMode: "LTX_NATIVE_AV" });
    assert.equal(response.generationJobId, "job-1"); assert.equal(response.status, "PENDING");
  } finally { if (previous === undefined) delete globalThis.window; else globalThis.window = previous; }
});
