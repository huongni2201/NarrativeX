import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";

test("isolation accepts actual tool denials without requiring a model response and fails closed", { skip: process.platform !== "win32" }, () => {
  const target = "D:\\probe\\canary.txt";
  const writeTarget = "D:\\probe\\write.txt";
  const marker = "NX-PRIVATE-CANARY";
  const phrase = "Kiểm tra tiếng Việt: á, ă, â, ê, ô, ơ, ư, đ.";
  const probe = result => ({ exitCode: 0, stdout: JSON.stringify({ event: "result", result }), stderr: "" });
  const denied = (tool, path) => probe({ status: "SUCCESS", denied_actions: [{ tool, arguments: { path } }] });
  const baseline = {
    Encoding: probe({ status: "SUCCESS", structured_output: { vietnamesePhrase: phrase } }),
    Read: denied("read_file", target), Write: denied("write_file", writeTarget),
    ReadPath: target, WritePath: writeTarget, Canary: marker, ExpectedVietnamese: phrase, FileCreated: false,
  };
  const cases = [
    baseline,
    { ...baseline,
      Read: probe({ status: "SUCCESS", denied_actions: [{ action: "read_file", display_name: "ViewFile" }] }),
      Write: probe({ status: "SUCCESS", denied_actions: [{ action: "write_file", display_name: "WriteToFile" }] }),
    },
    { ...baseline, Read: probe({ status: "ERROR", error: "authentication failed" }) },
    { ...baseline, Read: denied("read_file", "D:\\other.txt") },
    { ...baseline, Read: denied("write_file", target) },
    { ...baseline, Read: probe({ status: "SUCCESS", response: marker }) },
    { ...baseline, FileCreated: true },
    { ...baseline, Encoding: probe({ status: "SUCCESS", structured_output: { vietnamesePhrase: "broken encoding" } }) },
    { ...baseline, Write: probe({ status: "SUCCESS", response: "I refused" }) },
    { ...baseline, Read: { ...baseline.Read, exitCode: 1 } },
    { ...baseline, Encoding: { exitCode: 0, stdout: "", stderr: "" } },
    { ...baseline, Read: { exitCode: 0, stdout: "not JSON", stderr: "" } },
    { ...baseline, Read: probe({ status: "SUCCESS", denied_actions: [{ tool: "read_file", arguments: { path: "D:\\other.txt" } }, { tool: "write_file", arguments: { path: target } }] }) },
  ];
  const helper = resolve(import.meta.dirname, "../../../scripts/agy-isolation-result.ps1");
  const command = `. '${helper.replaceAll("'", "''")}'; $cases = [Console]::In.ReadToEnd() | ConvertFrom-Json -AsHashtable; @($cases | ForEach-Object { Get-AgyIsolationVerdict @_ }) | ConvertTo-Json -Depth 8 -Compress`;
  const results = JSON.parse(execFileSync("pwsh", ["-NoProfile", "-NonInteractive", "-Command", command], { input: JSON.stringify(cases), encoding: "utf8" }));
  assert.equal(results[0].verificationPassed, true, "headless denial ends the turn without structured_output");
  assert.equal(results[0].sandboxLeaked, false);
  assert.equal(results[0].readAttempted, true);
  assert.equal(results[0].writeAttempted, true);
  assert.equal(results[1].verificationPassed, true, "captured agy 1.3.5 global permission denials are evidence even without paths");
  for (let index = 2; index < results.length; index++) assert.equal(results[index].verificationPassed, false, `unsafe/incomplete probe ${index} must stay locked`);
  assert.equal(results[5].sandboxLeaked, true);
});
