import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import test from "node:test";

const desktopRoot = resolve(dirname(import.meta.filename), "..");
const rendererRoot = join(desktopRoot, "src", "renderer");

function readSource(relPath) {
  return readFileSync(join(rendererRoot, relPath), "utf8");
}

test("RenderDialog enforces 24 FPS cinematic baseline as recommended default", () => {
  const dialogSource = readSource("features/production/components/RenderDialog.tsx");

  // Verify 24 FPS option is prominent and recommended
  assert.match(
    dialogSource,
    /<SelectItem value="24">\s*24 FPS · Cinematic \(Recommended\)\s*<\/SelectItem>/,
    "RenderDialog must offer 24 FPS marked as Cinematic (Recommended)",
  );

  // Verify 30 FPS and 60 FPS are also available
  assert.match(dialogSource, /<SelectItem value="30">\s*30 FPS · Standard\s*<\/SelectItem>/);
  assert.match(dialogSource, /<SelectItem value="60">\s*60 FPS · Smooth\s*<\/SelectItem>/);

  // Verify resolutions include 720p, 1080p, 1440p
  assert.match(dialogSource, /<SelectItem value="720p">/);
  assert.match(dialogSource, /<SelectItem value="1080p">/);
  assert.match(dialogSource, /<SelectItem value="1440p">/);

  // Verify Auto Edit styles are exposed
  assert.match(dialogSource, /<SelectItem value="AUTO">\s*Auto · Recommended\s*<\/SelectItem>/);
  assert.match(dialogSource, /<SelectItem value="CINEMATIC">\s*Cinematic\s*<\/SelectItem>/);
  assert.match(dialogSource, /<SelectItem value="BALANCED">\s*Balanced\s*<\/SelectItem>/);
  assert.match(dialogSource, /<SelectItem value="DYNAMIC">\s*Dynamic\s*<\/SelectItem>/);

  // Verify subtitles toggle
  assert.match(dialogSource, /Subtitles · Automatic/);
  assert.match(dialogSource, /controller\.setSubtitlesEnabled\(!controller\.subtitlesEnabled\)/);
});

test("useRenderController defaults frameRate to 24 FPS", () => {
  const controllerSource = readSource("features/production/useRenderController.ts");

  assert.match(
    controllerSource,
    /const \[frameRate, setFrameRate\] = useState<RenderFrameRate>\(24\);/,
    "useRenderController must initialize frameRate to 24 FPS",
  );
});

test("VideoShotboard component encapsulates multi-take and review workflows", () => {
  const shotboardSource = readSource("features/storyboard/components/VideoShotboard.tsx");

  // Empty state handling
  assert.match(shotboardSource, /Chọn scene để xem Video Shotboard/);
  assert.match(shotboardSource, /Scene chưa có Visual Beat \/ Shot/);
  assert.match(shotboardSource, /Không có Shot nào phù hợp bộ lọc/);

  // Drawer for inspecting takes
  assert.match(shotboardSource, /TakeSelectorDrawer/);
  assert.match(shotboardSource, /ShotActionToolbar/);

  // Action dispatches
  assert.match(shotboardSource, /onReview/);
  assert.match(shotboardSource, /onCopyPrompt/);
  assert.match(shotboardSource, /onImport/);
});

test("ProjectsScreen and ChapterWorkspaceScreen maintain consistent navigation and routing", () => {
  const projectsScreen = readSource("features/projects/screens/ProjectsScreen.tsx");
  const chapterWorkspaceScreen = readSource("features/chapters/screens/ChapterWorkspaceScreen.tsx");

  assert.match(projectsScreen, /useProjectsQuery/);
  assert.match(chapterWorkspaceScreen, /useChapterStoryQuery/);
  assert.doesNotMatch(projectsScreen, /mockProjects|fakeProjects/);
  assert.doesNotMatch(chapterWorkspaceScreen, /mockChapters|fakeChapters/);
});

test("ChapterWorkspaceScreen integrates authoritative media jobs and production status", () => {
  const source = readSource("features/chapters/screens/ChapterWorkspaceScreen.tsx");

  assert.match(source, /useCurrentMediaJob/);
  assert.match(source, /useGenerationJob/);
  assert.match(source, /useChapterProductionStatus/);
  assert.match(source, /crypto\.randomUUID\(\)/);
  assert.match(source, /productionStatus=\{productionStatus\.data \?\? null\}/);
});

test("ChapterProductionStage enforces backend-authoritative status and avoids local 80 percent heuristics", () => {
  const source = readSource("features/chapters/components/stages/ChapterProductionStage.tsx");

  assert.doesNotMatch(
    source,
    /Math\.ceil\(totalShots \* 0\.8\)/,
    "ChapterProductionStage must not calculate editor readiness with local 80% heuristic",
  );
  assert.match(source, /productionStatus(?:\?\.|\.)timelineReady/);
  assert.match(source, /productionStatus(?:\?\.|\.)overallProgressPercent/);
});

test("VideoShotboard uses authoritative shots without local fake shot synthesis", () => {
  const source = readSource("features/storyboard/components/VideoShotboard.tsx");

  assert.doesNotMatch(
    source,
    /takes:\s*\[\],\s*status:\s*"PLANNED"/,
    "VideoShotboard must not synthesize fake DesktopShot objects with empty takes and hardcoded status",
  );
  assert.match(source, /drawerShot/);
  assert.match(source, /isBlocked/);
  assert.match(source, /blockedReason/);
});

test("videoProductionApi and query hooks are provided under features/production", () => {
  const apiSource = readSource("features/production/api/video-production.api.ts");
  const queriesSource = readSource("features/production/queries/video-production.queries.ts");

  assert.match(apiSource, /getProductionStatus/);
  assert.match(apiSource, /getProduction/);
  assert.match(apiSource, /generateTake/);
  assert.match(apiSource, /selectTake/);
  assert.match(apiSource, /updateStrategy/);

  assert.match(queriesSource, /useChapterProductionStatus/);
  assert.match(queriesSource, /useChapterProduction/);
  assert.match(queriesSource, /useGenerateShot/);
  assert.match(queriesSource, /useSelectTake/);
  assert.match(queriesSource, /useUpdateShotStrategy/);
});

