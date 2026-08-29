import test from "node:test";
import assert from "node:assert/strict";
import {
  buildRenderOutputFilename,
  resolveAvailableRenderPath,
} from "../src/main/rendering/render-destination.ts";

test("final render filename is sanitized and deterministic", () => {
  const now = new Date("2026-08-29T08:12:30.000Z");
  assert.equal(
    buildRenderOutputFilename("Lâm/Bất:Nhi? Story", now),
    "Lâm-Bất-Nhi-Story-20260829-081230.mp4",
  );
  assert.equal(
    buildRenderOutputFilename("   ", now),
    "narrativex-render-20260829-081230.mp4",
  );
});

test("delivery never overwrites an existing final video", async () => {
  const occupied = new Set([
    "/exports/project-20260829-081230.mp4",
    "/exports/project-20260829-081230-2.mp4",
  ]);
  const result = await resolveAvailableRenderPath(
    "/exports",
    "project-20260829-081230.mp4",
    async (path) => occupied.has(path.replaceAll("\\", "/")),
  );

  assert.equal(result.replaceAll("\\", "/"), "/exports/project-20260829-081230-3.mp4");
});
