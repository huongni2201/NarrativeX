import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const clientPath = new URL("../src/shared/api/client.ts", import.meta.url);

async function clientSource() {
  return readFile(clientPath, "utf8");
}

test("shared API client applies a bounded timeout to fetches", async () => {
  const source = await clientSource();

  assert.match(source, /DEFAULT_API_TIMEOUT_MS\s*=\s*30_000/);
  assert.match(source, /async function fetchWithTimeout/);
  assert.match(source, /setTimeout\(\(\) => \{/);
  assert.match(source, /throw new ApiRequestTimeoutError\(timeoutMs\)/);
  assert.match(source, /fetchWithTimeout\(apiUrl\("\/api\/v1\/auth\/csrf"\)/);
  assert.match(source, /const response = await fetchWithTimeout\(/);
});

test("timeout composition preserves and cleans up caller cancellation", async () => {
  const source = await clientSource();

  assert.match(source, /const callerSignal = init\.signal/);
  assert.match(source, /callerSignal\?\.addEventListener\("abort", abortFromCaller, \{ once: true \}\)/);
  assert.match(source, /callerSignal\?\.removeEventListener\("abort", abortFromCaller\)/);
  assert.match(source, /clearTimeout\(timeoutHandle\)/);
  assert.match(source, /signal: controller\.signal/);
});
