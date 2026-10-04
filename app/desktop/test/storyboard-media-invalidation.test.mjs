import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("preview-media invalidation owns all affected cache families", () => {
  const source = readFileSync(
    new URL("../src/renderer/features/storyboard/queries/storyboard-media.queries.ts", import.meta.url),
    "utf8",
  );
  assert.match(source, /storyboardKeys\.chapter\(projectId, chapterId\)/);
  assert.match(source, /storyQueryKeys\.chapterStory\(projectId, chapterId\)/);
  assert.match(source, /videoProductionQueryKeys\.chapter\(projectId, chapterId\)/);
  assert.match(source, /chapterAnalysisQueryKeys\.timeline\(projectId\)/);
  assert.match(source, /assetLibraryQueryKey\(projectId, "all"\)/);
  assert.match(source, /assetLibraryQueryKey\(projectId, "visual"\)/);
});

test("production preview import only accepts images and explains retained assets on bind failure", () => {
  const source = readFileSync(
    new URL("../src/renderer/features/chapters/components/stages/ChapterProductionStage.tsx", import.meta.url),
    "utf8",
  );
  assert.match(source, /allowedKinds:\s*\["IMAGE"\]/);
  assert.match(source, /nhập vào Thư viện nhưng chưa gắn làm ảnh xem trước/);
  assert.match(source, /invalidatePreviewMediaQueries\(queryClient, projectId, chapter\.id\)/);

  const shotboard = readFileSync(
    new URL("../src/renderer/features/storyboard/components/VideoShotboard.tsx", import.meta.url),
    "utf8",
  );
  assert.match(shotboard, /Import Reference Image/);
  assert.match(shotboard, /Replace Preview Image/);
});
