import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { nodeExec } from "../src/main/story-analysis/agy-exec.ts";
import { AgyRunner } from "../src/main/story-analysis/agy-runner.ts";

const output = { canon: { characters: [], locations: [] }, scenes: [{ title: "Đường vắng" }] };
const event = result => JSON.stringify({ event: "result", result });
const success = event({ status: "SUCCESS", conversation_id: "conv-1", structured_output: output });
const hanging = text => `process.stdout.write(${JSON.stringify(text)}); setInterval(() => {}, 1000);`;
const options = { timeoutMs: 2500, completeOnResult: true };

async function run(script, signal = new AbortController().signal) {
  const directory = await mkdtemp(join(tmpdir(), "nx-agy-exec-"));
  const runner = new AgyRunner({
    exec: (_file, _args, opts) => nodeExec(process.execPath, ["-e", script], { ...opts, timeoutMs: 2500 }),
    install: async () => ({ path: "agy.exe", version: "1.3.6" }), directory, isolationVerified: true,
  });
  try {
    return await runner.run({
      jobId: "j", projectId: "p", attemptId: "a", leaseToken: "lease", sourceLanguage: "vi",
      sourceUnits: [{ index: 0, text: "Lan đi qua con đường vắng." }], promptTemplate: "Analyze.",
      responseSchema: {}, profile: { model: "gemini-3.8-flash-low" },
      maxInputBytes: 200_000, maxOutputBytes: 200_000, maxRuntimeMs: 2500,
    }, signal);
  } finally { await rm(directory, { recursive: true, force: true }); }
}

test("runner delivers a terminal result even when agy never exits", async () => {
  let pid;
  const result = await nodeExec(process.execPath, ["-e", hanging(`${success}\n`)], { ...options, onSpawn: value => { pid = value; } });
  assert.equal(result.timedOut, false);
  assert.equal(result.resultReceived, true);
  assert.throws(() => process.kill(pid, 0), { code: "ESRCH" }, "the hanging process was cleaned up");
  const completed = await run(hanging(`${success}\n`));
  assert.deepEqual(JSON.parse(completed.rawJson), output);
  assert.equal(completed.conversationId, "conv-1");
});

test("result detection handles split chunks and ignores progress and model text", async () => {
  const split = Math.floor(success.length / 2);
  const script = `process.stdout.write(${JSON.stringify(`{"event":"step_update","step_update":{"text":${JSON.stringify(success)}}}\n${success.slice(0, split)}`)});
    setTimeout(() => process.stdout.write(${JSON.stringify(`${success.slice(split)}\n`)}), 50); setInterval(() => {}, 1000);`;
  assert.deepEqual(JSON.parse((await run(script)).rawJson), output);
});

test("a terminal failure is classified without waiting for process exit", async () => {
  await assert.rejects(run(hanging(`${event({ status: "ERROR", error: "RESOURCE_EXHAUSTED: quota exceeded" })}\n`)),
    error => error.code === "QUOTA_EXHAUSTED" && error.ambiguous === false);
});

test("progress, malformed results and incomplete lines cannot complete a run", async () => {
  for (const text of ['{"event":"step_update","status":"SUCCESS"}\n', '{"event":"result","result":null}\n', success]) {
    const result = await nodeExec(process.execPath, ["-e", hanging(text)], { ...options, timeoutMs: 300 });
    assert.equal(result.timedOut, true);
    assert.equal(Boolean(result.resultReceived), false);
  }
});

test("cancellation before a terminal result remains an abort", async () => {
  const controller = new AbortController();
  const result = await nodeExec(process.execPath, ["-e", "setInterval(() => {}, 1000)"], {
    ...options, signal: controller.signal, onSpawn: () => setTimeout(() => controller.abort(), 50),
  });
  assert.equal(result.aborted, true);
  assert.equal(Boolean(result.resultReceived), false);
});
