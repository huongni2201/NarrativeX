import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = (relative) =>
  fs.readFileSync(new URL(`../src/renderer/features/chapters/${relative}`, import.meta.url), "utf8");

const rail = read("components/ChapterRail.tsx");
const dialog = read("components/DeleteChapterDialog.tsx");
const screen = read("screens/ChapterWorkspaceScreen.tsx");
const queries = read("queries/chapters.queries.ts");
const api = read("api/chapters.api.ts");

test("chapter delete uses the DELETE chapter endpoint and refreshes chapter data", () => {
  assert.match(api, /remove: \(projectId: string, chapterId: string\)[\s\S]*method: "DELETE"/);
  assert.match(queries, /useDeleteChapter[\s\S]*chaptersApi\.remove\(projectId, chapterId\)[\s\S]*invalidateChapterData/);
});

test("chapter rail exposes a delete control that is a sibling of the select button", () => {
  assert.match(rail, /onDeleteChapter\?: \(chapterId: string\) => void/);
  assert.match(rail, /onDeleteChapter\(chapter\.id\)/);
  assert.match(rail, /aria-label=\{`Xoá /);
  // Buttons must not be nested: the delete button follows the select button's closing tag.
  assert.match(rail, /<\/button>\s*\{onDeleteChapter && \(\s*<button/);
});

test("deleting requires explicit confirmation and surfaces backend errors", () => {
  assert.match(dialog, /Xoá chương\?/);
  assert.match(dialog, /role="alert"/);
  assert.match(dialog, /if \(!open && !isPending\) onClose\(\)/);
  assert.match(screen, /<DeleteChapterDialog/);
  assert.match(screen, /onDeleteChapter=\{handleRequestDeleteChapter\}/);
  // Request step only opens the dialog; the mutation runs on confirm.
  assert.doesNotMatch(
    screen.match(/const handleRequestDeleteChapter[\s\S]*?\n  \};/)?.[0] ?? "",
    /mutateAsync/,
  );
});

test("after deleting the selected chapter the screen selects a neighbour or resets", () => {
  const confirm = screen.match(/const handleConfirmDeleteChapter[\s\S]*?\n  \};/)?.[0] ?? "";
  assert.match(confirm, /await deleteChapter\.mutateAsync\(target\.id\)/);
  assert.match(confirm, /catch \{\s*return;/);
  assert.match(confirm, /chapters\[index \+ 1\] \?\? chapters\[index - 1\] \?\? null/);
  assert.match(confirm, /setSelectedBeatId\(null\)/);
  assert.match(confirm, /if \(!next\) setCurrentStage\("source"\)/);
});
