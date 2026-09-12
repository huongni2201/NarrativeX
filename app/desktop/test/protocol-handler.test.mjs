import test from "node:test";
import assert from "node:assert/strict";
import {
  extractDesktopAuthCode,
  extractDesktopAuthError,
  isNarrativeXProtocolUrl,
} from "../src/main/auth/protocol-handler.ts";

const attempt = "00000000-0000-4000-8000-000000000001";

test("desktop protocol accepts only the correlated NarrativeX auth callback shape", () => {
  const code = "a".repeat(43);
  const callback = `narrativex://auth/callback?code=${code}&attempt=${attempt}`;
  assert.equal(isNarrativeXProtocolUrl(callback), true);
  assert.equal(extractDesktopAuthCode(callback), `${code}.${attempt}`);
  assert.equal(extractDesktopAuthCode("narrativex://other/callback?code=secret"), null);
  assert.equal(extractDesktopAuthCode("narrativex://auth/other?code=secret"), null);
  assert.equal(extractDesktopAuthCode("https://auth/callback?code=secret"), null);
  assert.equal(extractDesktopAuthCode(`narrativex://auth/callback?code=${code}`), null);
  assert.equal(
    extractDesktopAuthCode(`narrativex://auth/callback?code=${code}&attempt=not-a-uuid`),
    null,
  );
  assert.equal(
    extractDesktopAuthCode(
      `narrativex://auth/callback?code=${code}&attempt=${attempt}&code_verifier=secret`,
    ),
    null,
  );
});

test("desktop protocol does not treat arbitrary schemes or malformed URLs as callbacks", () => {
  assert.equal(isNarrativeXProtocolUrl("narrativex-malicious://auth/callback?code=x"), false);
  assert.equal(extractDesktopAuthCode("narrativex://auth/callback?code=%ZZ"), null);
  assert.equal(extractDesktopAuthCode("narrativex://auth/callback"), null);
});

test("desktop protocol accepts controlled authentication failure callbacks", () => {
  assert.equal(
    extractDesktopAuthError(
      `narrativex://auth/callback?error=authentication_failed&attempt=${attempt}`,
    ),
    "authentication_failed",
  );
  assert.equal(
    extractDesktopAuthError("narrativex://auth/callback?error=authentication_failed"),
    "authentication_failed",
  );
  assert.equal(extractDesktopAuthError("narrativex://auth/callback?error=access_denied"), null);
  assert.equal(
    extractDesktopAuthError("narrativex://auth/callback?error=authentication_failed&detail=secret"),
    null,
  );
});
