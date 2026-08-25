import test from "node:test";
import assert from "node:assert/strict";
import {
  extractDesktopAuthCode,
  isNarrativeXProtocolUrl,
} from "../src/main/auth/protocol-handler.ts";

test("desktop protocol accepts only the NarrativeX auth callback shape", () => {
  const callback = `narrativex://auth/callback?code=${"a".repeat(43)}`;
  assert.equal(isNarrativeXProtocolUrl(callback), true);
  assert.equal(extractDesktopAuthCode(callback), "a".repeat(43));
  assert.equal(extractDesktopAuthCode("narrativex://other/callback?code=secret"), null);
  assert.equal(extractDesktopAuthCode("narrativex://auth/other?code=secret"), null);
  assert.equal(extractDesktopAuthCode("https://auth/callback?code=secret"), null);
  assert.equal(extractDesktopAuthCode("narrativex://auth/callback?code=%20%20"), null);
  assert.equal(
    extractDesktopAuthCode(`narrativex://auth/callback?code=${"a".repeat(43)}&code_verifier=secret`),
    null,
  );
});

test("desktop protocol does not treat arbitrary schemes or malformed URLs as callbacks", () => {
  assert.equal(isNarrativeXProtocolUrl("narrativex-malicious://auth/callback?code=x"), false);
  assert.equal(extractDesktopAuthCode("narrativex://auth/callback?code=%ZZ"), null);
  assert.equal(extractDesktopAuthCode("narrativex://auth/callback"), null);
});
