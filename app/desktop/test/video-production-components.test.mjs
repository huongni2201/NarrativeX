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

test("ProjectsScreen and ChaptersScreen maintain consistent navigation and routing", () => {
  const projectsScreen = readSource("features/projects/screens/ProjectsScreen.tsx");
  const chaptersScreen = readSource("features/chapters/screens/ChaptersScreen.tsx");

  assert.match(projectsScreen, /useProjectsQuery/);
  assert.match(chaptersScreen, /useChapterWorkspacesQuery/);
  assert.doesNotMatch(projectsScreen, /mockProjects|fakeProjects/);
  assert.doesNotMatch(chaptersScreen, /mockChapters|fakeChapters/);
});
