import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import test from "node:test";

const apiTypesPath = resolve("src/types/api.ts");

test("accepts UUID project and chapter responses from the backend API", () => {
  const result = spawnSync(
    process.execPath,
    [
      "--experimental-strip-types",
      "--input-type=module",
      "-e",
      `
        import { isApiChapter, isApiProject, isApiResponse } from ${JSON.stringify(`file:///${apiTypesPath.replaceAll("\\", "/")}`)};
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
        const chapter = {
          id: "01a03105-f151-72f1-9489-764b06a43bc6",
          storyVersionId: "01a03105-f143-7ef0-87a2-fe8d113624bf",
          orderIndex: 0,
          title: "Xuyên Thành Phản Diện",
          sourceText: "Chapter source",
          sourceHash: "d9caffd093df0dd0f1e28e6e0e2afb35a52ea2abea7894571ceb26d6d6a2c2c7",
          rowVersion: 0,
        };
        const chapterEnvelope = {
          success: true,
          message: "Chapter created successfully",
          data: chapter,
          timestamp: "2026-08-23T23:47:48.195729023Z",
        };
        process.stdout.write(JSON.stringify({
          project: isApiProject(project),
          envelope: isApiResponse(envelope, isApiProject),
          chapter: isApiChapter(chapter),
          chapterEnvelope: isApiResponse(chapterEnvelope, isApiChapter),
        }));
      `,
    ],
    { cwd: resolve("."), encoding: "utf8" },
  );

  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout), {
    project: true,
    envelope: true,
    chapter: true,
    chapterEnvelope: true,
  });
});
