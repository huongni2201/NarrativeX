export interface SubtitlePlanningChapter {
  chapterId: string;
  globalStartMs: number;
  globalEndMs: number;
  subtitleText: string;
  subtitleSpansJson: string | null;
}

export interface PlannedSubtitle {
  chapterId: string;
  startMs: number;
  endMs: number;
  text: string;
  timingSource: "NARRATION_ALIGNMENT" | "TEXT_WEIGHT_FALLBACK";
}

interface AlignmentSpan {
  index: number;
  textStart: number;
  textEnd: number;
  audioStartMs: number;
  audioEndMs: number;
}

const MAX_CUE_CHARS = 72;
const MIN_CUE_MS = 240;
const MAX_ALIGNMENT_TAIL_DRIFT_MS = 250;

export function planSubtitles(
  chapters: readonly SubtitlePlanningChapter[],
): PlannedSubtitle[] {
  return chapters.flatMap((chapter) => planChapterSubtitles(chapter));
}

export function planChapterSubtitles(
  chapter: SubtitlePlanningChapter,
): PlannedSubtitle[] {
  const sourceText = chapter.subtitleText ?? "";
  const chapterDurationMs = Math.max(0, chapter.globalEndMs - chapter.globalStartMs);
  if (!sourceText.trim() || chapterDurationMs <= 0) return [];

  const spans = parseAlignmentSpans(
    chapter.subtitleSpansJson,
    sourceText.length,
    chapterDurationMs,
  );
  if (spans.length) {
    return spans.flatMap((span) => {
      const spanText = cleanCueText(sourceText.slice(span.textStart, span.textEnd));
      if (!spanText) return [];
      return splitTimedText(
        chapter.chapterId,
        spanText,
        chapter.globalStartMs + span.audioStartMs,
        chapter.globalStartMs + span.audioEndMs,
        "NARRATION_ALIGNMENT",
      );
    });
  }

  const chunks = splitReadableText(normalizeFallbackText(sourceText));
  if (!chunks.length) return [];
  const weights = chunks.map((chunk) => Math.max(1, visibleWeight(chunk)));
  const totalWeight = weights.reduce((sum, value) => sum + value, 0);
  const cues: PlannedSubtitle[] = [];
  let cursor = chapter.globalStartMs;
  let cumulative = 0;
  for (let index = 0; index < chunks.length; index += 1) {
    cumulative += weights[index];
    const end =
      index === chunks.length - 1
        ? chapter.globalEndMs
        : chapter.globalStartMs + Math.round((chapterDurationMs * cumulative) / totalWeight);
    cues.push({
      chapterId: chapter.chapterId,
      startMs: cursor,
      endMs: Math.max(cursor + 1, Math.min(end, chapter.globalEndMs)),
      text: chunks[index],
      timingSource: "TEXT_WEIGHT_FALLBACK",
    });
    cursor = cues[cues.length - 1].endMs;
  }
  return cues.filter((cue) => cue.endMs > cue.startMs);
}

function parseAlignmentSpans(
  raw: string | null,
  textLength: number,
  chapterDurationMs: number,
): AlignmentSpan[] {
  if (!raw) return [];
  try {
    const value = JSON.parse(raw) as unknown;
    if (!Array.isArray(value) || !value.length) return [];
    const result: AlignmentSpan[] = [];
    let previousTextEnd = 0;
    let previousAudioEnd = 0;
    for (let index = 0; index < value.length; index += 1) {
      const item = value[index];
      if (!item || typeof item !== "object") return [];
      const span = item as Partial<AlignmentSpan>;
      if (
        !Number.isInteger(span.index) ||
        !Number.isInteger(span.textStart) ||
        !Number.isInteger(span.textEnd) ||
        !Number.isFinite(span.audioStartMs) ||
        !Number.isFinite(span.audioEndMs)
      ) {
        return [];
      }
      const normalized: AlignmentSpan = {
        index: Number(span.index),
        textStart: Number(span.textStart),
        textEnd: Number(span.textEnd),
        audioStartMs: Math.round(Number(span.audioStartMs)),
        audioEndMs: Math.round(Number(span.audioEndMs)),
      };
      const isLast = index === value.length - 1;
      if (
        normalized.textStart < previousTextEnd ||
        normalized.textEnd <= normalized.textStart ||
        normalized.textEnd > textLength ||
        normalized.audioStartMs < previousAudioEnd ||
        normalized.audioEndMs <= normalized.audioStartMs ||
        (!isLast && normalized.audioEndMs > chapterDurationMs)
      ) {
        return [];
      }
      result.push(normalized);
      previousTextEnd = normalized.textEnd;
      previousAudioEnd = normalized.audioEndMs;
    }

    const last = result.at(-1);
    if (
      !last ||
      Math.abs(last.audioEndMs - chapterDurationMs) > MAX_ALIGNMENT_TAIL_DRIFT_MS ||
      chapterDurationMs <= last.audioStartMs
    ) {
      return [];
    }
    result[result.length - 1] = { ...last, audioEndMs: chapterDurationMs };
    return result;
  } catch {
    return [];
  }
}

function splitTimedText(
  chapterId: string,
  text: string,
  startMs: number,
  endMs: number,
  timingSource: PlannedSubtitle["timingSource"],
): PlannedSubtitle[] {
  const chunks = splitReadableText(text);
  if (chunks.length <= 1) {
    return [{ chapterId, startMs, endMs, text, timingSource }];
  }
  const duration = Math.max(1, endMs - startMs);
  const weights = chunks.map((chunk) => Math.max(1, visibleWeight(chunk)));
  const totalWeight = weights.reduce((sum, value) => sum + value, 0);
  let cursor = startMs;
  let cumulative = 0;
  return chunks.map((chunk, index) => {
    cumulative += weights[index];
    const rawEnd =
      index === chunks.length - 1
        ? endMs
        : startMs + Math.round((duration * cumulative) / totalWeight);
    const cueEnd = Math.min(endMs, Math.max(cursor + 1, rawEnd));
    const cue = { chapterId, startMs: cursor, endMs: cueEnd, text: chunk, timingSource };
    cursor = cueEnd;
    return cue;
  });
}

function splitReadableText(value: string): string[] {
  const sentences = value
    .split(/(?<=[.!?…。！？])\s+/u)
    .map(cleanCueText)
    .filter(Boolean);
  const source = sentences.length ? sentences : [cleanCueText(value)].filter(Boolean);
  const chunks: string[] = [];
  for (const sentence of source) {
    if (sentence.length <= MAX_CUE_CHARS) {
      chunks.push(sentence);
      continue;
    }
    const words = sentence.split(/\s+/u).filter(Boolean);
    let current = "";
    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word;
      if (current && candidate.length > MAX_CUE_CHARS) {
        chunks.push(current);
        current = word;
      } else {
        current = candidate;
      }
    }
    if (current) chunks.push(current);
  }
  return chunks;
}

function normalizeFallbackText(value: string): string {
  return value.replace(/\r\n?/g, "\n").trim();
}

function cleanCueText(value: string): string {
  return value.replace(/\s+/gu, " ").trim();
}

function visibleWeight(value: string): number {
  return value.replace(/\s+/gu, "").length;
}

export function subtitleCueIsRenderable(cue: PlannedSubtitle): boolean {
  return Boolean(cue.text.trim()) && cue.endMs - cue.startMs >= MIN_CUE_MS;
}

export function activeSubtitleAt(
  cues: readonly PlannedSubtitle[],
  playheadMs: number,
): PlannedSubtitle | null {
  return cues.find((cue) => playheadMs >= cue.startMs && playheadMs < cue.endMs) ?? null;
}
