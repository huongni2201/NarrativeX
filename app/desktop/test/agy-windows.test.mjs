import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { AgyRunner } from "../src/main/story-analysis/agy-runner.ts";
import { errorsOf, mergeCanon, planWindows, repairMessage } from "../src/main/story-analysis/agy-windows.ts";

// ---- pure helpers -----------------------------------------------------------------------------------------------

const units = (count, text = "x".repeat(100)) => Array.from({ length: count }, (_, index) => ({ index, text }));

test("a chapter that fits one window stays one window", () => {
  assert.deepEqual(planWindows(units(10), 6_000), [{ first: 0, last: 9, index: 0, count: 1 }]);
});

test("windows are consecutive, cover every unit once and respect the size limit", () => {
  const all = units(100);
  const windows = planWindows(all, 1_000);
  assert.ok(windows.length > 1);
  assert.equal(windows[0].first, 0);
  assert.equal(windows.at(-1).last, 99);
  windows.forEach((window, position) => {
    assert.equal(window.index, position);
    assert.equal(window.count, windows.length);
    assert.ok((window.last - window.first + 1) * 100 <= 1_000);
    if (position > 0) assert.equal(window.first, windows[position - 1].last + 1);
  });
});

test("a window ends on the end of a sentence when one is close", () => {
  const all = units(30).map((unit, index) => ({ ...unit, text: index === 7 ? `${"x".repeat(98)}.` : unit.text }));
  const windows = planWindows(all, 1_000);
  assert.equal(windows[0].last, 7, "the window moved back from unit 9 to the sentence end at unit 7");
});

test("an entity listed again keeps its first definition and gains aliases", () => {
  const first = mergeCanon({ characters: [], locations: [] }, { characters: [{ ai_name: "Lan", role: "PROTAGONIST", aliases: ["cô"] }], locations: [{ ai_name: "Nhà", name: "Nhà" }] });
  const second = mergeCanon(first, { characters: [{ ai_name: "lan", role: "EXTRA", aliases: ["cô Lan"] }, { ai_name: "Minh", role: "SUPPORTING" }], locations: [] });
  assert.equal(second.characters.length, 2);
  assert.equal(second.characters[0].role, "PROTAGONIST");
  assert.deepEqual(second.characters[0].aliases.sort(), ["cô", "cô Lan"]);
  assert.equal(second.locations.length, 1);
});

test("a repair request lists errors only and says which units it covers", () => {
  const text = repairMessage([
    { severity: "ERROR", path: "scenes[0].visual_beats[1]", message: "start_unit 5 must be greater than the previous beat's 7" },
    { severity: "WARNING", path: "scenes[0].visual_beats[2]", message: "beat covers 200 characters" },
  ], { first: 40, last: 79, index: 1, count: 3 });
  assert.match(text, /units 40\.\.79/u);
  assert.match(text, /visual_beats\[1\]: start_unit 5/u);
  assert.doesNotMatch(text, /200 characters/u);
  assert.equal(errorsOf(null), 0);
});

// ---- the runner: validation, repair and windows -------------------------------------------------------------------

const INSTALL = { path: "agy.exe", version: "1.3.5" };
const claim = (overrides = {}) => ({
  jobId: "job-1", projectId: "p", attemptId: "attempt-1", leaseToken: "lease",
  sourceUnits: [{ index: 0, text: "Một." }, { index: 1, text: "Hai." }, { index: 2, text: "Ba." }, { index: 3, text: "Bốn." }],
  sourceLanguage: "vi", promptTemplate: "Analyze.", responseSchema: { type: "object" },
  profile: { model: "gemini-3.8-flash-high", effort: "HIGH", promptHash: "a", schemaHash: "b" },
  maxInputBytes: 200_000, maxOutputBytes: 200_000, maxRuntimeMs: 600_000, ...overrides,
});
const usage = { input_tokens: 100, output_tokens: 10, thinking_tokens: 0, cache_read_tokens: 0, total_tokens: 110 };
const reply = (structured, conversation = "conv-1") => ({
  exitCode: 0, stderr: "", timedOut: false, aborted: false, spawnError: null,
  stdout: JSON.stringify({ conversation_id: conversation, status: "SUCCESS", response: "", structured_output: structured, usage }),
});
const lastLine = stdin => JSON.parse(JSON.parse(stdin).message.content.split("\n").at(-1));

async function harness(respond, options = {}) {
  const directory = await mkdtemp(join(tmpdir(), "nx-agy-windows-"));
  const calls = [];
  const runner = new AgyRunner({
    exec: async (file, args, opts) => { calls.push({ args, opts }); return respond(calls.length, args, opts); },
    install: async () => INSTALL, directory, isolationVerified: true, env: { PATH: "p" }, ...options,
  });
  return { runner, calls, cleanup: () => rm(directory, { recursive: true, force: true }) };
}
const result = scenes => ({ canon: { characters: [], locations: [] }, scenes });
const run = (h, c = claim(), hooks = {}) => h.runner.run(c, new AbortController().signal, hooks);

test("without a backend check the result is delivered after one call", async () => {
  const h = await harness(() => reply(result([{ title: "a" }])));
  try {
    const done = await run(h);
    assert.equal(h.calls.length, 1);
    assert.deepEqual(JSON.parse(done.rawJson).scenes, [{ title: "a" }]);
    assert.equal(done.adapterVersion, "antigravity-cli/2");
  } finally { await h.cleanup(); }
});

test("warnings never cost a second call", async () => {
  const h = await harness(() => reply(result([{ title: "a" }])));
  try {
    await run(h, claim(), { validate: async () => [{ severity: "WARNING", path: "p", message: "m" }] });
    assert.equal(h.calls.length, 1);
  } finally { await h.cleanup(); }
});

test("an invalid result gets one repair turn in the same conversation, and the better result wins", async () => {
  const checked = [];
  const h = await harness(count => count === 1 ? reply(result([{ title: "broken" }]), "conv-7") : reply(result([{ title: "fixed" }]), "conv-7"));
  try {
    const done = await run(h, claim(), {
      validate: async raw => {
        checked.push(JSON.parse(raw).scenes[0].title);
        return JSON.parse(raw).scenes[0].title === "broken" ? [{ severity: "ERROR", path: "scenes[0]", message: "bad" }] : [];
      },
    });
    assert.equal(h.calls.length, 2);
    assert.deepEqual(h.calls[1].args.slice(h.calls[1].args.indexOf("--conversation")), ["--conversation", "conv-7"]);
    assert.equal(h.calls[0].args.includes("--conversation"), false);
    assert.match(JSON.parse(h.calls[1].opts.stdin).message.content, /scenes\[0\]: bad/u);
    assert.equal(JSON.parse(done.rawJson).scenes[0].title, "fixed");
    assert.deepEqual(checked, ["broken", "fixed"]);
    assert.equal(done.usage.promptTokens, 200, "both calls are counted");
  } finally { await h.cleanup(); }
});

test("a repair that is not better, or that fails, never replaces the original result", async () => {
  for (const second of [() => reply(result([{ title: "still broken" }])), () => ({ exitCode: 139, stdout: "", stderr: "segfault", timedOut: false, aborted: false, spawnError: null })]) {
    const h = await harness(count => count === 1 ? reply(result([{ title: "first" }])) : second());
    try {
      const done = await run(h, claim(), { validate: async () => [{ severity: "ERROR", path: "p", message: "m" }] });
      assert.equal(h.calls.length, 2, "exactly one repair attempt");
      assert.equal(JSON.parse(done.rawJson).scenes[0].title, "first");
    } finally { await h.cleanup(); }
  }
});

test("a check that cannot be made leaves the result untouched", async () => {
  const h = await harness(() => reply(result([{ title: "a" }])));
  try {
    await run(h, claim(), { validate: async () => { throw new Error("offline"); } });
    await run(h, claim(), { validate: async () => null });
    assert.equal(h.calls.length, 2, "one call per run, no repair");
  } finally { await h.cleanup(); }
});

test("a long chapter runs window by window and the results are combined", async () => {
  const bounds = [];
  const h = await harness((count, args, opts) => {
    const payload = lastLine(opts.stdin);
    return reply({
      canon: { characters: [{ ai_name: count === 1 ? "Lan" : "Minh", canonical_name: "x", role: "EXTRA", importance: "BACKGROUND", visual_prompt: "v" }], locations: [] },
      scenes: [{ title: `scene ${count}`, units: payload.units.map(unit => unit.i) }],
    }, `conv-${count}`);
  }, { windowMaxChars: 8 });
  try {
    const done = await run(h, claim(), { validate: async (raw, first, last) => { bounds.push([first, last, Object.keys(JSON.parse(raw).canon)]); return []; } });
    assert.equal(h.calls.length, 2);
    const [first, second] = h.calls.map(call => lastLine(call.opts.stdin));
    assert.deepEqual(first.window, { number: 1, of: 2, firstUnit: 0, lastUnit: 1 });
    assert.deepEqual(first.units.map(unit => unit.i), [0, 1]);
    assert.deepEqual(second.units.map(unit => unit.i), [2, 3]);
    assert.deepEqual(second.knownCanon.characters.map(entry => entry.ai_name), ["Lan"], "the second window reuses the names of the first");
    assert.equal(second.previousScene.title, "scene 1");
    assert.match(JSON.parse(h.calls[1].opts.stdin).message.content, /Your first visual beat must have start_unit 2/u);
    assert.deepEqual(bounds.map(entry => entry.slice(0, 2)), [[0, 1], [2, 3]], "each window is checked against its own units");
    const combined = JSON.parse(done.rawJson);
    assert.deepEqual(combined.scenes.map(scene => scene.title), ["scene 1", "scene 2"]);
    assert.deepEqual(combined.canon.characters.map(entry => entry.ai_name), ["Lan", "Minh"]);
    assert.equal(done.conversationId, "conv-2");
    assert.equal(done.usage.promptTokens, 200);
  } finally { await h.cleanup(); }
});

test("a failing window fails the whole chapter; nothing partial is delivered", async () => {
  const h = await harness(count => count === 1 ? reply(result([{ title: "a" }])) : { exitCode: null, stdout: "", stderr: "", timedOut: true, aborted: false, spawnError: null }, { windowMaxChars: 8 });
  try {
    await assert.rejects(run(h), error => error.code === "ANALYSIS_TIMEOUT" && error.ambiguous === false);
  } finally { await h.cleanup(); }
});

test("a window that does not fit the input limit is refused before any call", async () => {
  const h = await harness(() => reply(result([])));
  try {
    await assert.rejects(run(h, claim({ maxInputBytes: 50 })), error => error.code === "INPUT_TOO_LARGE");
    assert.equal(h.calls.length, 0);
  } finally { await h.cleanup(); }
});

test("a cancelled chapter does not start the next window", async () => {
  const controller = new AbortController();
  const h = await harness(count => { controller.abort(); return reply(result([{ title: String(count) }])); }, { windowMaxChars: 8 });
  try {
    await assert.rejects(h.runner.run(claim(), controller.signal), error => error.code === "USER_CANCELLED");
    assert.equal(h.calls.length, 1);
  } finally { await h.cleanup(); }
});

test("progress rises through the model turn and the check and stops at 95 for a single-window chapter", async () => {
  const seen = [];
  const h = await harness(() => reply(result([{ title: "a" }])));
  try {
    await run(h, claim(), { validate: async () => [], onProgress: percent => seen.push(percent) });
    assert.deepEqual(seen, [67, 81, 95]);
  } finally { await h.cleanup(); }
});

test("progress is shared out over the windows of a long chapter and never goes backwards", async () => {
  const seen = [];
  const h = await harness(count => reply(result([{ title: String(count) }])), { windowMaxChars: 8 });
  try {
    await run(h, claim(), { validate: async () => [], onProgress: percent => seen.push(percent) });
    assert.equal(h.calls.length, 2);
    assert.deepEqual(seen, [33, 40, 48, 81, 88, 95]);
    assert.ok(seen.every((percent, index) => index === 0 || percent > seen[index - 1]), "strictly rising");
  } finally { await h.cleanup(); }
});

test("while a model turn runs the bar creeps towards the next milestone but never reaches it", async () => {
  const seen = [];
  const h = await harness(async () => { await new Promise(resolve => setTimeout(resolve, 150)); return reply(result([{ title: "a" }])); }, { progressTickMs: 10 });
  try {
    await run(h, claim(), { validate: async () => [], onProgress: percent => seen.push(percent) });
    const milestone = seen.indexOf(67);
    assert.ok(milestone > 0, `expected estimated steps before the real milestone, got ${seen}`);
    assert.ok(seen.slice(0, milestone).every(percent => percent < 67), "an estimate never claims the milestone");
    assert.ok(seen.every((percent, index) => index === 0 || percent > seen[index - 1]), "strictly rising");
    assert.deepEqual(seen.slice(milestone), [67, 81, 95]);
  } finally { await h.cleanup(); }
});
