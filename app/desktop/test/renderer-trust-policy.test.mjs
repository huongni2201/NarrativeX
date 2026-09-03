import test from "node:test";
import assert from "node:assert/strict";

test("packaged renderer trust policy resolves the renderer beside the main bundle", async () => {
  const { createRendererTrustPolicy } = await import("../src/main/security/renderer-trust-policy.ts");

  const policy = createRendererTrustPolicy(
    "C:\\Program Files\\NarrativeX\\resources\\app.asar\\out\\main",
    true,
    "http://localhost:5173",
  );

  assert.equal(
    policy.productionEntryPath,
    "C:\\Program Files\\NarrativeX\\resources\\app.asar\\out\\renderer\\index.html",
  );
  assert.equal(policy.developmentRendererUrl, undefined);
});
