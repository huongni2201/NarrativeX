import assert from "node:assert/strict";
import test from "node:test";
import { GeminiAdaptiveConcurrency, isCapacityPressure } from "../src/main/gemini-web/gemini-concurrency-policy.ts";

test("quota and timeout pressure reduce effective concurrency without going below one", () => {
  const policy = new GeminiAdaptiveConcurrency();
  assert.equal(policy.capacity(4), 4);
  policy.recordFailure(new Error("429 quota exceeded"));
  assert.equal(policy.capacity(4), 3);
  policy.recordFailure(new Error("generation timed out"));
  assert.equal(policy.capacity(4), 2);
  policy.recordFailure(new Error("resource exhausted"));
  policy.recordFailure(new Error("resource exhausted"));
  assert.equal(policy.capacity(4), 1);
});

test("stable successful generations recover capacity gradually", () => {
  const policy = new GeminiAdaptiveConcurrency();
  policy.capacity(4);
  policy.recordFailure(new Error("quota"));
  assert.equal(policy.capacity(4), 3);
  policy.recordSuccess(4);
  policy.recordSuccess(4);
  assert.equal(policy.capacity(4), 3);
  policy.recordSuccess(4);
  assert.equal(policy.capacity(4), 4);
});

test("ordinary provider errors do not throttle the pool", () => {
  assert.equal(isCapacityPressure(new Error("invalid prompt")), false);
});
