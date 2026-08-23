import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import test from "node:test";

const apiTypesPath = resolve("src/types/api.ts");

test("accepts the UUID project response returned by POST /api/v1/projects", () => {
  const result = spawnSync(
    process.execPath,
    [
      "--experimental-strip-types",
      "--input-type=module",
      "-e",
      `
        import { isApiProject, isApiResponse } from ${JSON.stringify(`file:///${apiTypesPath.replaceAll("\\", "/")}`)};
        const project = {
          id: "01a030f6-d881-7091-a532-27c29a10b65c",
          name: "Sau Khi Tiếng Lòng Của Phản Diện Bị Lộ",
          description: null,
          coverImageUrl: null,
          status: "DRAFT",
          sourceLanguage: "vi-VN",
          narrationLanguage: "vi-VN",
          metadataLanguage: "vi-VN",
          imageAspectRatio: "16:9",
          imageQualityTier: "STANDARD",
          rowVersion: 0,
        };
        const envelope = {
          success: true,
          message: "Project created successfully",
          data: project,
          timestamp: "2026-08-23T23:31:18.791125559Z",
        };
        process.stdout.write(JSON.stringify({ project: isApiProject(project), envelope: isApiResponse(envelope, isApiProject) }));
      `,
    ],
    { cwd: resolve("."), encoding: "utf8" },
  );

  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout), { project: true, envelope: true });
});
