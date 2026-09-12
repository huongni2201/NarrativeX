export interface SubtitlePlanningChapter {
  chapterId: string;
  globalStartMs: number;
  globalEndMs: number;
  subtitleText: string;
  subtitleWordsJson: string | null;
}

export interface PlannedSubtitle {
  chapterId: string;
  startMs: number;
  endMs: number;
  text: string;
  timingSource: "WORD_ALIGNMENT";
}

interface WordAlignment {
  index: number;
  textStart: number;
  textEnd: number;
  audioStartMs: number;
  audioEndMs: number;
  confidence: number;
}

const MAX_CUE_CHARS = 96;
const MAX_CUE_MS = 4_500;
const FORCE_BREAK_GAP_MS = 600;
const PREFERRED_CLAUSE_BREAK_CHARS = 48;
const PREFERRED_CLAUSE_BREAK_MS = 1_800;
const TERMINAL_PUNCTUATION = /[.!?…。！？]["'”’)]*$/u;
const CLAUSE_PUNCTUATION = /[,;:，；：]["'”’)]*$/u;

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

  const words = parseWordAlignments(
    chapter.subtitleWordsJson,
    sourceText.length,
    chapterDurationMs,
  );
  if (!words.length) return [];

  return groupWordsIntoCues(chapter.chapterId, sourceText, chapter.globalStartMs, words);
}

function parseWordAlignments(
  raw: string | null,
  textLength: number,
  chapterDurationMs: number,
): WordAlignment[] {
  if (!raw) return [];
  try {
    const value = JSON.parse(raw) as unknown;
    if (!Array.isArray(value) || !value.length) return [];

    const words: WordAlignment[] = [];
    let previousTextEnd = 0;
    let previousAudioEnd = 0;
    for (let expectedIndex = 0; expectedIndex < value.length; expectedIndex += 1) {
      const item = value[expectedIndex];
      if (!item || typeof item !== "object") return [];
      const word = item as Partial<WordAlignment>;
      if (
        !Number.isInteger(word.index) ||
        !Number.isInteger(word.textStart) ||
        !Number.isInteger(word.textEnd) ||
        !Number.isFinite(word.audioStartMs) ||
        !Number.isFinite(word.audioEndMs) ||
        !Number.isFinite(word.confidence)
      ) {
        return [];
      }

      const normalized: WordAlignment = {
        index: Number(word.index),
        textStart: Number(word.textStart),
        textEnd: Number(word.textEnd),
        audioStartMs: Math.round(Number(word.audioStartMs)),
        audioEndMs: Math.round(Number(word.audioEndMs)),
        confidence: Number(word.confidence),
      };
      if (
        normalized.index !== expectedIndex ||
        normalized.textStart < previousTextEnd ||
        normalized.textEnd <= normalized.textStart ||
        normalized.textEnd > textLength ||
        normalized.audioStartMs < previousAudioEnd ||
        normalized.audioEndMs <= normalized.audioStartMs ||
        normalized.audioEndMs > chapterDurationMs ||
        normalized.confidence < 0 ||
        normalized.confidence > 1
      ) {
        return [];
      }

      words.push(normalized);
      previousTextEnd = normalized.textEnd;
      previousAudioEnd = normalized.audioEndMs;
    }
    return words;
  } catch {
    return [];
  }
}

function groupWordsIntoCues(
  chapterId: string,
  sourceText: string,
  chapterStartMs: number,
  words: readonly WordAlignment[],
): PlannedSubtitle[] {
  const cues: PlannedSubtitle[] = [];
  let cueStartIndex = 0;

  const pushCue = (endIndex: number) => {
    if (endIndex < cueStartIndex) return;
    const first = words[cueStartIndex];
    const last = words[endIndex];
    const text = cleanCueText(sourceText.slice(first.textStart, cueTextEnd(sourceText, last, words[endIndex + 1])));
    if (text) {
      cues.push({
        chapterId,
        startMs: chapterStartMs + first.audioStartMs,
        endMs: chapterStartMs + last.audioEndMs,
        text,
        timingSource: "WORD_ALIGNMENT",
      });
    }
    cueStartIndex = endIndex + 1;
  };

  for (let index = 0; index < words.length; index += 1) {
    const current = words[index];
    const previous = index > cueStartIndex ? words[index - 1] : null;

    if (previous && current.audioStartMs - previous.audioEndMs >= FORCE_BREAK_GAP_MS) {
      pushCue(index - 1);
    }

    if (index < cueStartIndex) continue;
    const first = words[cueStartIndex];
    const candidateText = cleanCueText(
      sourceText.slice(first.textStart, cueTextEnd(sourceText, current, words[index + 1])),
    );
    const candidateDurationMs = current.audioEndMs - first.audioStartMs;

    if (
      index > cueStartIndex &&
      (candidateText.length > MAX_CUE_CHARS || candidateDurationMs > MAX_CUE_MS)
    ) {
      pushCue(index - 1);
    }

    if (index < cueStartIndex) continue;
    const activeFirst = words[cueStartIndex];
    const activeText = cleanCueText(
      sourceText.slice(activeFirst.textStart, cueTextEnd(sourceText, current, words[index + 1])),
    );
    const activeDurationMs = current.audioEndMs - activeFirst.audioStartMs;
    const punctuationAfterWord = sourceText.slice(
      current.textEnd,
      words[index + 1]?.textStart ?? sourceText.length,
    );

    if (
      TERMINAL_PUNCTUATION.test(punctuationAfterWord.trim()) ||
      (CLAUSE_PUNCTUATION.test(punctuationAfterWord.trim()) &&
        (activeText.length >= PREFERRED_CLAUSE_BREAK_CHARS ||
          activeDurationMs >= PREFERRED_CLAUSE_BREAK_MS))
    ) {
      pushCue(index);
    }
  }

  if (cueStartIndex < words.length) pushCue(words.length - 1);
  return cues.filter((cue) => cue.endMs > cue.startMs);
}

function cueTextEnd(
  sourceText: string,
  word: WordAlignment,
  nextWord: WordAlignment | undefined,
): number {
  const boundary = nextWord?.textStart ?? sourceText.length;
  const between = sourceText.slice(word.textEnd, boundary);
  const punctuation = between.match(/^\s*[^\p{L}\p{N}_\s]+/u)?.[0] ?? "";
  return Math.min(boundary, word.textEnd + punctuation.length);
}

function cleanCueText(value: string): string {
  return value.replace(/\s+/gu, " ").trim();
}

export function subtitleCueIsRenderable(cue: PlannedSubtitle): boolean {
  return Boolean(cue.text.trim()) && cue.endMs > cue.startMs;
}

export function activeSubtitleAt(
  cues: readonly PlannedSubtitle[],
  playheadMs: number,
): PlannedSubtitle | null {
  return cues.find((cue) => playheadMs >= cue.startMs && playheadMs < cue.endMs) ?? null;
}
