import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, extname, join, resolve } from "node:path";
import test from "node:test";

const desktopRoot = resolve(dirname(import.meta.filename), "..");
const rendererRoot = join(desktopRoot, "src", "renderer");
const featuresRoot = join(rendererRoot, "features");
const legacyApiFiles = [
  "assets.api.ts",
  "catalog.api.ts",
  "chapters.api.ts",
  "generation.api.ts",
  "narration.api.ts",
  "production.api.ts",
  "projects.api.ts",
  "workspace.ts",
];

function sourceFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return [".ts", ".tsx"].includes(extname(entry.name)) ? [path] : [];
  });
}

test("domain APIs live inside owning features", () => {
  for (const file of legacyApiFiles) {
    assert.equal(
      existsSync(join(rendererRoot, "api", file)),
      false,
      `legacy renderer/api/${file} must not exist`,
    );
  }
});

test("features only use renderer/api for shared transport primitives", () => {
  const forbidden = /(?:\.\.\/){2,}api\/(?:assets\.api|catalog\.api|chapters\.api|generation\.api|narration\.api|production\.api|projects\.api|workspace)/;
  const violations = [];
  for (const file of sourceFiles(featuresRoot)) {
    const source = readFileSync(file, "utf8");
    if (forbidden.test(source)) violations.push(file.replace(`${desktopRoot}/`, ""));
  }
  assert.deepEqual(violations, []);
});

test("VideoShotboard delegates media transport workflows to feature queries", () => {
  const storyboardRoot = join(featuresRoot, "storyboard");
  const shotboardPath = join(storyboardRoot, "components", "VideoShotboard.tsx");
  const source = readFileSync(shotboardPath, "utf8");

  assert.doesNotMatch(source, /import\s+\{\s*assetsApi\s*\}/);
  assert.doesNotMatch(source, /import\s+\{\s*productionApi\s*\}/);
  assert.match(source, /useStoryboardImagePreview/);
});

test("VideoShotboard composes focused video shot presentation components", () => {
  const storyboardRoot = join(featuresRoot, "storyboard");
  const componentRoot = join(storyboardRoot, "components");
  const requiredComponents = [
    "VideoShotboard.tsx",
    "TakeSelectorDrawer.tsx",
    "ShotActionToolbar.tsx",
    "RetentionPlanView.tsx",
  ];

  for (const component of requiredComponents) {
    assert.equal(
      existsSync(join(componentRoot, component)),
      true,
      `storyboard/components/${component} must exist`,
    );
  }

  const source = readFileSync(join(storyboardRoot, "components", "VideoShotboard.tsx"), "utf8");
  assert.match(source, /<TakeSelectorDrawer\b/);
  assert.match(source, /<ShotActionToolbar\b/);
  assert.match(source, /export function VideoShotboard\b/);
});

test("EditorScreen delegates media persistence and preview transport to feature queries", () => {
  const editorRoot = join(featuresRoot, "editor");
  const source = readFileSync(join(editorRoot, "EditorScreen.tsx"), "utf8");

  assert.doesNotMatch(source, /import\s+\{\s*useQueryClient\s*\}/);
  assert.doesNotMatch(source, /import\s+\{\s*assetsApi\s*\}/);
  assert.doesNotMatch(source, /import\s+\{\s*productionApi\s*\}/);
  assert.doesNotMatch(source, /\bassetsApi\.downloadUrl\s*\(/);
  assert.doesNotMatch(source, /\bassetsApi\.registerLocal\s*\(/);
  assert.doesNotMatch(source, /\bproductionApi\.(?:updateBeatMedia|resetBeatMedia)\s*\(/);
  assert.doesNotMatch(source, /window\.narrativex\.localStorage\.(?:selectAsset|commitSelectedAsset)\s*\(/);
  assert.match(source, /useEditorMediaMutations/);
  assert.match(source, /useEditorPreviewSources/);
});

test("AssetsScreen delegates local media workflows to feature queries", () => {
  const source = readFileSync(
    join(featuresRoot, "assets", "screens", "AssetsScreen.tsx"),
    "utf8",
  );

  assert.doesNotMatch(source, /import\s+\{[^}]*\buseQueryClient\b[^}]*\}\s+from\s+["']@tanstack\/react-query["']/s);
  assert.doesNotMatch(source, /import\s+\{\s*assetsApi\s*\}/);
  assert.doesNotMatch(source, /window\.narrativex\.localStorage\.(?:selectAsset|commitSelectedAsset|repairSelectedAsset|verifyProject)\s*\(/);
  assert.match(source, /useProjectAssetLocalStates/);
  assert.match(source, /useProjectAssetImport/);
});

test("CharactersScreen delegates generation and queue workflows to feature queries", () => {
  const source = readFileSync(
    join(featuresRoot, "characters", "screens", "CharactersScreen.tsx"),
    "utf8",
  );

  assert.doesNotMatch(source, /import\s+\{[^}]*\buseQueryClient\b[^}]*\}\s+from\s+["']@tanstack\/react-query["']/s);
  assert.doesNotMatch(source, /import\s+\{\s*charactersApi\s*\}/);
  assert.match(source, /useCharacterPortrait/);
});

test("ChapterWorkspaceScreen delegates analysis and story queries to feature hooks", () => {
  const source = readFileSync(
    join(featuresRoot, "chapters", "screens", "ChapterWorkspaceScreen.tsx"),
    "utf8",
  );

  assert.doesNotMatch(source, /import\s+\{\s*useMutation/);
  assert.match(source, /useAnalyzeChapter/);
  assert.match(source, /useChapterStoryQuery/);
  assert.match(source, /useCreateMediaJob/);
});
