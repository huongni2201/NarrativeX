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

const MAX_CUE_CHARS = 96;
const ORPHAN_CUE_MAX_CHARS = 28;
const ORPHAN_CUE_MAX_WORDS = 4;
const PREFERRED_BREAK_TOLERANCE_CHARS = 18;
const MIN_CUE_MS = 240;
const MAX_ALIGNMENT_TAIL_DRIFT_MS = 250;
const TERMINAL_PUNCTUATION = /[.!?…。！？]["'”’)]*$/u;
const CLAUSE_PUNCTUATION = /[,;:，；：]$/u;

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
    const cues = spans.flatMap((span) => {
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
    return mergeOrphanCues(cues);
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
  return source.flatMap((sentence) =>
    sentence.length <= MAX_CUE_CHARS ? [sentence] : splitBalancedSentence(sentence),
  );
}

function splitBalancedSentence(sentence: string): string[] {
  const chunkCount = Math.ceil(sentence.length / MAX_CUE_CHARS);
  const chunks: string[] = [];
  let remaining = cleanCueText(sentence);
  let remainingChunks = chunkCount;

  while (remaining && remainingChunks > 1) {
    const idealSplit = Math.round(remaining.length / remainingChunks);
    const minSplit = Math.max(1, remaining.length - MAX_CUE_CHARS * (remainingChunks - 1));
    const maxSplit = Math.min(MAX_CUE_CHARS, remaining.length - (remainingChunks - 1));
    const splitAt = chooseReadableSplit(remaining, minSplit, maxSplit, idealSplit);
    const head = cleanCueText(remaining.slice(0, splitAt));
    if (!head) break;
    chunks.push(head);
    remaining = cleanCueText(remaining.slice(splitAt));
    remainingChunks -= 1;
  }

  if (remaining) chunks.push(remaining);
  return chunks;
}

function chooseReadableSplit(
  value: string,
  minSplit: number,
  maxSplit: number,
  idealSplit: number,
): number {
  const whitespaceBreaks: number[] = [];
  const clauseBreaks: number[] = [];

  for (let index = minSplit; index <= maxSplit; index += 1) {
    if (!/\s/u.test(value[index] ?? "")) continue;
    whitespaceBreaks.push(index);
    const previous = value.slice(0, index).trimEnd().at(-1) ?? "";
    if (
      CLAUSE_PUNCTUATION.test(previous) &&
      Math.abs(index - idealSplit) <= PREFERRED_BREAK_TOLERANCE_CHARS
    ) {
      clauseBreaks.push(index);
    }
  }

  const candidates = clauseBreaks.length ? clauseBreaks : whitespaceBreaks;
  if (!candidates.length) return maxSplit;
  return candidates.reduce((best, current) =>
    Math.abs(current - idealSplit) < Math.abs(best - idealSplit) ? current : best,
  );
}

function mergeOrphanCues(cues: readonly PlannedSubtitle[]): PlannedSubtitle[] {
  const merged: PlannedSubtitle[] = [];
  for (const cue of cues) {
    const previous = merged.at(-1);
    if (previous && shouldMergeOrphanCue(previous, cue)) {
      merged[merged.length - 1] = {
        ...previous,
        endMs: cue.endMs,
        text: cleanCueText(`${previous.text} ${cue.text}`),
      };
      continue;
    }
    merged.push(cue);
  }
  return merged;
}

function shouldMergeOrphanCue(previous: PlannedSubtitle, current: PlannedSubtitle): boolean {
  if (
    previous.chapterId !== current.chapterId ||
    previous.timingSource !== current.timingSource ||
    previous.endMs !== current.startMs ||
    TERMINAL_PUNCTUATION.test(previous.text.trim())
  ) {
    return false;
  }

  const currentText = cleanCueText(current.text);
  const currentWordCount = currentText.split(/\s+/u).filter(Boolean).length;
  if (currentText.length > ORPHAN_CUE_MAX_CHARS || currentWordCount > ORPHAN_CUE_MAX_WORDS) {
    return false;
  }
  return cleanCueText(`${previous.text} ${currentText}`).length <= MAX_CUE_CHARS;
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
