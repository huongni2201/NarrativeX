import test from "node:test";
import assert from "node:assert/strict";
import { evaluateQuota, modelFamily, parseModels, parseUsage } from "../src/main/story-analysis/agy-usage.ts";

const usageJson = JSON.stringify({
  command: { data: { groups: [
    { name: "Gemini Models", buckets: [
      { window: "5h", remaining_fraction: 0.8, reset_time: "2026-10-16T01:00:00Z" },
      { window: "weekly", remaining_fraction: 0.5, reset_time: "2026-10-20T00:00:00Z" },
    ] },
    { name: "Claude and GPT models", buckets: [
      { window: "5h", remaining_fraction: 0.01, reset_time: "2026-10-16T03:00:00Z" },
      { window: "weekly", remaining_fraction: 0.9, reset_time: "2026-10-21T00:00:00Z" },
    ] },
  ] } },
});

test("usage parses both model groups with 5h and weekly buckets", () => {
  const groups = parseUsage(`progress line\n${usageJson}\n`);
  assert.equal(groups.length, 2);
  assert.deepEqual(groups[0], { family: "gemini", fiveHourRemaining: 0.8, fiveHourResetsAt: "2026-10-16T01:00:00Z", weeklyRemaining: 0.5, weeklyResetsAt: "2026-10-20T00:00:00Z" });
  assert.equal(groups[1].family, "third-party");
  assert.deepEqual(parseUsage("not json"), []);
});

test("quota is exhausted below 3 percent and resumes at the latest exhausted reset", () => {
  const now = Date.parse("2026-10-15T00:00:00Z");
  const groups = parseUsage(usageJson);
  assert.deepEqual(evaluateQuota(groups, "gemini-3.8-flash-high", now), { state: "AVAILABLE", nextEligibleAt: null });
  const third = evaluateQuota(groups, "claude-sonnet-4-6", now);
  assert.equal(third.state, "EXHAUSTED");
  assert.equal(third.nextEligibleAt, Date.parse("2026-10-16T03:00:00Z"));

  const both = [{ family: "gemini", fiveHourRemaining: 0.02, fiveHourResetsAt: "2026-10-15T05:00:00Z", weeklyRemaining: 0.0, weeklyResetsAt: "2026-10-18T00:00:00Z" }];
  const exhausted = evaluateQuota(both, "gemini-3.8-flash-low", now);
  assert.equal(exhausted.nextEligibleAt, Date.parse("2026-10-18T00:00:00Z"));
  assert.equal(evaluateQuota([], "gemini-3.8-flash-low", now).state, "UNKNOWN");
  // Exactly 3 percent is still usable; the threshold is strictly below.
  assert.equal(evaluateQuota([{ ...both[0], fiveHourRemaining: 0.03, weeklyRemaining: 0.5 }], "gemini-x", now).state, "AVAILABLE");
});

test("models parse from plain lines and from JSON", () => {
  const text = "Available models:\n  * gemini-3.8-flash-high\n  - claude-sonnet-4-6\ngpt-oss-120b-medium (default)\n";
  assert.deepEqual(parseModels(text).map(item => item.slug), ["gemini-3.8-flash-high", "claude-sonnet-4-6", "gpt-oss-120b-medium"]);
  assert.equal(modelFamily("gemini-3.8-flash-high"), "gemini");
  assert.equal(modelFamily("claude-opus-4-6-thinking"), "third-party");
  const json = JSON.stringify({ models: [{ id: "gemini-3.8-flash-low" }, { id: "claude-sonnet-4-6" }, { id: "gemini-3.8-flash-low" }] });
  assert.deepEqual(parseModels(json).map(item => item.slug), ["gemini-3.8-flash-low", "claude-sonnet-4-6"]);
});
