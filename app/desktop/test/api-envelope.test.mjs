import assert from "node:assert/strict";
import test from "node:test";
import { parseSuccessEnvelope, isRecord } from "../src/shared/api-envelope.ts";

test("success envelope validates unknown JSON without guessing data", () => {
  const envelope = { success: true, message: "OK", timestamp: "2026-10-03T00:00:00Z", data: { content: [], nextCursor: null, limit: 20, hasNext: false } };
  assert.deepEqual(parseSuccessEnvelope(JSON.stringify(envelope)), envelope);
  assert.equal(parseSuccessEnvelope(JSON.stringify({ ...envelope, data: null })).data, null);
  assert.equal("data" in parseSuccessEnvelope(JSON.stringify({ success: true, message: "OK", timestamp: envelope.timestamp })), false);
  for (const value of [[], null, { success: true }, { ...envelope, success: false }, { ...envelope, timestamp: 1 }]) {
    assert.throws(() => parseSuccessEnvelope(JSON.stringify(value)));
  }
  assert.throws(() => parseSuccessEnvelope("broken JSON"));
  assert.equal(isRecord([]), false);
  assert.equal(isRecord(null), false);
  assert.equal(isRecord({}), true);
});
