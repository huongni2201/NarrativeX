import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

const desktopRoot = resolve(dirname(import.meta.filename), "..");
const rendererRoot = join(desktopRoot, "src", "renderer");

test("ComputeStatusIndicator displays truthful AI runtimes and fails closed", () => {
  const source = readFileSync(
    join(rendererRoot, "features", "workspace", "components", "ComputeStatusIndicator.tsx"),
    "utf8"
  );

  // Queries both provider health and runtime capabilities
  assert.match(source, /useProviderHealthQuery/);
  assert.match(source, /useRuntimeCapabilities/);

  // While loading, shows Checking rather than faking Ready
  assert.match(source, /isChecking\s*\?\s*"Checking"/);
  assert.match(source, /Compute: Checking\.\.\./);

  // Displays LTX Video generation capabilities truthfully
  assert.match(source, /LTX Video Worker/);
  assert.match(source, /videoCapability\.model/);
  assert.match(source, /videoStatus/);

  // No fake hardcoded READY for unverified engines
  assert.doesNotMatch(source, /VieNeu[\s\S]*?READY/);
  assert.doesNotMatch(source, /WhisperX[\s\S]*?READY/);
  assert.doesNotMatch(source, /ComfyUI[\s\S]*?READY/);
});

test("job history query scopes requests by projectId", () => {
  const querySource = readFileSync(
    join(rendererRoot, "features", "jobs", "queries", "jobs.queries.ts"),
    "utf8"
  );
  const apiSource = readFileSync(
    join(rendererRoot, "features", "jobs", "api", "jobs.api.ts"),
    "utf8"
  );
  const indicatorSource = readFileSync(
    join(rendererRoot, "features", "workspace", "components", "JobStatusIndicator.tsx"),
    "utf8"
  );
  const screenSource = readFileSync(
    join(rendererRoot, "features", "jobs", "screens", "JobsScreen.tsx"),
    "utf8"
  );

  assert.match(querySource, /history:\s*\(/);
  assert.match(querySource, /useJobHistoryQuery\(projectId\?: string/);
  assert.match(apiSource, /projectId\?: string/);
  assert.match(apiSource, /params\.set\("projectId", projectId\)/);
  assert.match(indicatorSource, /useJobHistoryQuery\(projectId/);
  assert.match(screenSource, /useJobHistoryQuery\(projectId/);
});
