import test from "node:test";
import assert from "node:assert/strict";
import { runLocalRenderPreflight } from "../src/renderer/features/production/local-render-executor.ts";

test("an unpaired local executor is paired before render preflight", async () => {
  const calls = [];
  const readyPreflight = {
    ready: true,
    blockers: [],
    warnings: [],
    assets: [],
    diskFreeBytes: 1_000_000,
    estimatedOutputBytes: 100,
    requiredTemporaryBytes: 200,
  };

  const result = await runLocalRenderPreflight(
    {
      projectId: "project-1",
      assetIds: [],
      assets: [],
      estimatedOutputBytes: 100,
      requiredTemporaryBytes: 200,
    },
    {
      status: async () => {
        calls.push("status");
        return {
          state: "UNPAIRED",
          backendBaseUrl: "http://localhost:8080",
          deviceId: null,
          capabilities: ["DESKTOP_APP", "PROJECT_RENDER"],
          projectRenderEnabled: true,
          unfinishedRenderCount: 0,
          lastError: null,
        };
      },
      requestPairingCode: async () => {
        calls.push("pairing-code");
        return { code: "ABC123", expiresAt: "2026-08-31T00:00:00Z" };
      },
      pair: async (code) => {
        calls.push(`pair:${code}`);
        return {
          state: "ONLINE",
          backendBaseUrl: "http://localhost:8080",
          deviceId: "device-1",
          capabilities: ["DESKTOP_APP", "PROJECT_RENDER"],
          projectRenderEnabled: true,
          unfinishedRenderCount: 0,
          lastError: null,
        };
      },
      preflight: async () => {
        calls.push("preflight");
        return readyPreflight;
      },
    },
  );

  assert.equal(result, readyPreflight);
  assert.deepEqual(calls, ["status", "pairing-code", "pair:ABC123", "preflight"]);
});
