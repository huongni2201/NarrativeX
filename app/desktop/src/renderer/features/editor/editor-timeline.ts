import type { DesktopTimeline, DesktopTimelineBeat } from "@narrativex/client-contracts";

export type EditorScope = "beat" | "scene" | "chapter" | "project";

type DesktopChapter = DesktopTimeline["chapters"][number];

export interface EditorSceneGroup {
  chapterId: string;
  sceneIndex: number;
  beats: DesktopTimelineBeat[];
  startMs: number;
  endMs: number;
  durationMs: number;
  readyBeatCount: number;
}

export interface EditorChapterGroup {
  chapter: DesktopChapter;
  scenes: EditorSceneGroup[];
  beats: DesktopTimelineBeat[];
}

export interface EditorScopeWindow {
  startMs: number;
  endMs: number;
  beats: DesktopTimelineBeat[];
}

export function buildEditorHierarchy(
  chapters: readonly DesktopChapter[],
  beats: readonly DesktopTimelineBeat[],
): EditorChapterGroup[] {
  const beatsByChapter = new Map<string, DesktopTimelineBeat[]>();

  for (const beat of beats) {
    const chapterBeats = beatsByChapter.get(beat.chapterId) ?? [];
    chapterBeats.push(beat);
    beatsByChapter.set(beat.chapterId, chapterBeats);
  }

  return [...chapters]
    .sort((left, right) => left.orderIndex - right.orderIndex)
    .map((chapter) => {
      const chapterBeats = [...(beatsByChapter.get(chapter.chapterId) ?? [])].sort(compareBeats);
      const scenes = groupScenes(chapterBeats);
      return { chapter, scenes, beats: chapterBeats };
    });
}

export function groupScenes(beats: readonly DesktopTimelineBeat[]): EditorSceneGroup[] {
  const scenes = new Map<number, DesktopTimelineBeat[]>();

  for (const beat of beats) {
    const sceneBeats = scenes.get(beat.sceneIndex) ?? [];
    sceneBeats.push(beat);
    scenes.set(beat.sceneIndex, sceneBeats);
  }

  return [...scenes.entries()]
    .sort(([left], [right]) => left - right)
    .map(([sceneIndex, sceneBeats]) => {
      const sortedBeats = [...sceneBeats].sort(compareBeats);
      const startMs = sortedBeats[0]?.startMs ?? 0;
      const endMs = sortedBeats.at(-1)?.endMs ?? startMs;
      return {
        chapterId: sortedBeats[0]?.chapterId ?? "",
        sceneIndex,
        beats: sortedBeats,
        startMs,
        endMs,
        durationMs: Math.max(0, endMs - startMs),
        readyBeatCount: sortedBeats.filter((beat) => beat.assetReady).length,
      };
    });
}

export function resolveEditorScopeWindow({
  chapters,
  beats,
  selected,
  scope,
  totalMs,
}: Readonly<{
  chapters: readonly DesktopChapter[];
  beats: readonly DesktopTimelineBeat[];
  selected: DesktopTimelineBeat | null;
  scope: EditorScope;
  totalMs: number;
}>): EditorScopeWindow {
  const projectEndMs = Math.max(totalMs, ...beats.map((beat) => beat.endMs), 0);

  if (!selected || scope === "project") {
    return {
      startMs: 0,
      endMs: projectEndMs,
      beats: [...beats].sort(compareBeats),
    };
  }

  if (scope === "beat") {
    return {
      startMs: selected.startMs,
      endMs: selected.endMs,
      beats: [selected],
    };
  }

  if (scope === "scene") {
    const sceneBeats = beats
      .filter(
        (beat) =>
          beat.chapterId === selected.chapterId && beat.sceneIndex === selected.sceneIndex,
      )
      .sort(compareBeats);
    return windowFromBeats(sceneBeats, selected.startMs, selected.endMs);
  }

  const chapterBeats = beats
    .filter((beat) => beat.chapterId === selected.chapterId)
    .sort(compareBeats);
  const chapter = chapters.find((candidate) => candidate.chapterId === selected.chapterId);
  const fallback = windowFromBeats(chapterBeats, selected.startMs, selected.endMs);

  return {
    startMs: chapter?.startMs ?? fallback.startMs,
    endMs: chapter?.endMs ?? fallback.endMs,
    beats: chapterBeats,
  };
}

function windowFromBeats(
  beats: readonly DesktopTimelineBeat[],
  fallbackStartMs: number,
  fallbackEndMs: number,
): EditorScopeWindow {
  if (!beats.length) {
    return { startMs: fallbackStartMs, endMs: fallbackEndMs, beats: [] };
  }

  return {
    startMs: beats[0].startMs,
    endMs: beats.at(-1)?.endMs ?? beats[0].endMs,
    beats: [...beats],
  };
}

function compareBeats(left: DesktopTimelineBeat, right: DesktopTimelineBeat) {
  return left.startMs - right.startMs || left.beatIndex - right.beatIndex;
}
