import test from "node:test";
import assert from "node:assert/strict";
import { join } from "node:path";
import { AgyInstallResolver, compareVersions, locateAgy } from "../src/main/story-analysis/agy-locator.ts";

const reply = (stdout, exitCode = 0) => ({ exitCode, stdout, stderr: "", timedOut: false, aborted: false, spawnError: null });

function deps({ where = [], versions = {}, existing = [], env = {}, platform = "win32" }) {
  const calls = [];
  return {
    calls,
    value: {
      platform, home: "C:\\Users\\me", env,
      exists: async path => existing.includes(path),
      exec: async (file, args) => {
        calls.push([file, ...args].join(" "));
        if (file === "where") return where.length ? reply(where.join("\r\n")) : reply("", 1);
        return reply(versions[file] ? `agy ${versions[file]}\n` : "");
      },
    },
  };
}

test("versions compare numerically", () => {
  assert.ok(compareVersions("1.3.5", "1.3.0") > 0);
  assert.ok(compareVersions("1.10.0", "1.9.9") > 0);
  assert.equal(compareVersions("1.3.0", "1.3.0"), 0);
});

test("explicit override wins over PATH and default folders", async () => {
  const d = deps({
    env: { NARRATIVEX_AGY_PATH: "D:\\tools\\agy.exe", LOCALAPPDATA: "C:\\Users\\me\\AppData\\Local" },
    where: ["C:\\path\\agy.exe"],
    existing: ["D:\\tools\\agy.exe", "C:\\path\\agy.exe"],
    versions: { "D:\\tools\\agy.exe": "1.3.5", "C:\\path\\agy.exe": "1.4.0" },
  });
  assert.deepEqual(await locateAgy(d.value), { ok: true, install: { path: "D:\\tools\\agy.exe", version: "1.3.5" } });
});

test("PATH comes before the two default install folders", async () => {
  const local = join("C:\\Users\\me\\AppData\\Local", "agy", "bin", "agy.exe");
  const gemini = join("C:\\Users\\me", ".gemini", "bin", "agy.exe");
  const d = deps({ env: { LOCALAPPDATA: "C:\\Users\\me\\AppData\\Local" }, where: ["C:\\path\\agy.exe"], existing: ["C:\\path\\agy.exe", local, gemini], versions: { "C:\\path\\agy.exe": "1.3.5", [local]: "1.3.5", [gemini]: "1.3.5" } });
  assert.equal((await locateAgy(d.value)).install.path, "C:\\path\\agy.exe");
  const defaults = deps({ env: { LOCALAPPDATA: "C:\\Users\\me\\AppData\\Local" }, existing: [local, gemini], versions: { [local]: "1.3.5", [gemini]: "1.3.5" } });
  assert.equal((await locateAgy(defaults.value)).install.path, local);
  const onlyGemini = deps({ existing: [gemini], versions: { [gemini]: "1.3.5" } });
  assert.equal((await locateAgy(onlyGemini.value)).install.path, gemini);
});

test("old versions, missing installs and other platforms are rejected with a reason", async () => {
  const gemini = join("C:\\Users\\me", ".gemini", "bin", "agy.exe");
  assert.deepEqual(await locateAgy(deps({ existing: [gemini], versions: { [gemini]: "1.2.9" } }).value), { ok: false, issue: "AGY_VERSION_UNSUPPORTED" });
  assert.deepEqual(await locateAgy(deps({}).value), { ok: false, issue: "AGY_NOT_FOUND" });
  assert.deepEqual(await locateAgy(deps({ platform: "linux" }).value), { ok: false, issue: "PLATFORM_UNSUPPORTED" });
});

test("resolver caches a found install but retries a failed lookup", async () => {
  let lookups = 0;
  const results = [{ ok: false, issue: "AGY_NOT_FOUND" }, { ok: true, install: { path: "agy", version: "1.3.5" } }];
  const resolver = new AgyInstallResolver(async () => results[Math.min(lookups++, 1)]);
  assert.equal((await resolver.install()), null);
  assert.equal((await resolver.install()).path, "agy");
  await resolver.install();
  assert.equal(lookups, 2);
  assert.equal((await resolver.resolve(true)).ok, true);
  assert.equal(lookups, 3);
});
