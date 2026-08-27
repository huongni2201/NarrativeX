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

export function sortEditorBeats(beats: readonly DesktopTimelineBeat[]): DesktopTimelineBeat[] {
  return [...beats].sort(compareBeats);
}

export function findEditorBeatAtTime(
  beats: readonly DesktopTimelineBeat[],
  targetMs: number,
): DesktopTimelineBeat | null {
  if (!beats.length) return null;
  const ordered = sortEditorBeats(beats);
  let low = 0;
  let high = ordered.length - 1;

  while (low <= high) {
    const middle = Math.floor((low + high) / 2);
    const beat = ordered[middle];
    const isLast = middle === ordered.length - 1;
    if (targetMs < beat.startMs) {
      high = middle - 1;
      continue;
    }
    if (targetMs > beat.endMs || (!isLast && targetMs === beat.endMs)) {
      low = middle + 1;
      continue;
    }
    return beat;
  }

  return null;
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
      const chapterBeats = sortEditorBeats(beatsByChapter.get(chapter.chapterId) ?? []);
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
      const sortedBeats = sortEditorBeats(sceneBeats);
      const startMs = sortedBeats.reduce(
        (earliest, beat) => Math.min(earliest, beat.startMs),
        sortedBeats[0]?.startMs ?? 0,
      );
      const endMs = sortedBeats.reduce(
        (latest, beat) => Math.max(latest, beat.endMs),
        startMs,
      );
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
  const projectEndMs = beats.reduce(
    (latest, beat) => Math.max(latest, beat.endMs),
    Math.max(0, totalMs),
  );

  if (!selected || scope === "project") {
    return {
      startMs: 0,
      endMs: projectEndMs,
      beats: sortEditorBeats(beats),
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
    const sceneBeats = beats.filter(
      (beat) =>
        beat.chapterId === selected.chapterId && beat.sceneIndex === selected.sceneIndex,
    );
    return windowFromBeats(sortEditorBeats(sceneBeats), selected.startMs, selected.endMs);
  }

  const chapterBeats = sortEditorBeats(
    beats.filter((beat) => beat.chapterId === selected.chapterId),
  );
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

  const startMs = beats.reduce(
    (earliest, beat) => Math.min(earliest, beat.startMs),
    beats[0].startMs,
  );
  const endMs = beats.reduce(
    (latest, beat) => Math.max(latest, beat.endMs),
    beats[0].endMs,
  );

  return {
    startMs,
    endMs,
    beats: [...beats],
  };
}

function compareBeats(left: DesktopTimelineBeat, right: DesktopTimelineBeat) {
  return left.startMs - right.startMs || left.beatIndex - right.beatIndex;
}
