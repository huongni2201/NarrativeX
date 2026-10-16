package com.narrativex.backend.feature.storyboard.application.service;

import java.util.ArrayList;
import java.util.List;
import java.util.Set;

/**
 * Splits a chapter into numbered source units. The model references positions by unit index instead
 * of copying text, so the backend remains the only authority for UTF-16 offsets (ADR-0006).
 *
 * <p>The algorithm is deterministic and versioned: the Desktop receives the units at claim time and
 * the materializer recomputes them from the same source text. Change it only together with {@link
 * #VERSION} and the analysis contract. Offsets refer to the source after CRLF/CR normalization to
 * LF, like every other source range.
 */
public final class SourceUnitSegmenter {
  public static final String VERSION = "1";

  /**
   * Hard cap per unit: about 6 s of narration, so one unit can never exceed the 10 s visual beat
   * limit.
   */
  static final int MAX_UNIT_CHARS = 100;

  private static final String TERMINATORS = ".!?…";
  private static final String CLOSERS = "\"'”’»)]}";
  private static final String CLAUSE_SEPARATORS = ",;:—–";
  private static final Set<String> ABBREVIATIONS =
      Set.of("tp", "mr", "mrs", "ms", "dr", "prof", "ts", "ths", "gs", "pgs", "st");

  /** A contiguous, trimmed, non-empty range of the normalized source. */
  public record SourceUnit(int index, int start, int end, String text) {}

  private SourceUnitSegmenter() {}

  public static String normalize(String source) {
    return source.replace("\r\n", "\n").replace('\r', '\n');
  }

  public static List<SourceUnit> segment(String rawSource) {
    if (rawSource == null || rawSource.isBlank()) {
      throw new IllegalArgumentException("sourceText must not be null or blank");
    }
    String source = normalize(rawSource);
    List<int[]> spans = new ArrayList<>();
    int length = source.length();
    int lineStart = 0;
    while (lineStart < length) {
      int lineEnd = source.indexOf('\n', lineStart);
      if (lineEnd < 0) lineEnd = length;
      splitLine(source, lineStart, lineEnd, spans);
      lineStart = lineEnd + 1;
    }
    List<SourceUnit> units = new ArrayList<>(spans.size());
    for (int[] span : spans) {
      units.add(new SourceUnit(units.size(), span[0], span[1], source.substring(span[0], span[1])));
    }
    return List.copyOf(units);
  }

  private static void splitLine(String source, int from, int to, List<int[]> out) {
    int start = skipWhitespace(source, from, to);
    while (start < to) {
      int end = sentenceEnd(source, start, to);
      splitLong(source, start, end, out);
      start = skipWhitespace(source, end, to);
    }
  }

  /** Exclusive end of the sentence that starts at {@code start}, without trailing whitespace. */
  private static int sentenceEnd(String source, int start, int to) {
    int index = start;
    while (index < to) {
      char current = source.charAt(index);
      if (TERMINATORS.indexOf(current) < 0) {
        index++;
        continue;
      }
      int runStart = index;
      while (index < to && TERMINATORS.indexOf(source.charAt(index)) >= 0) index++;
      int afterTerminators = index;
      while (index < to && CLOSERS.indexOf(source.charAt(index)) >= 0) index++;
      boolean boundary = index >= to || Character.isWhitespace(source.charAt(index));
      if (boundary && !continuesSentence(source, start, runStart, afterTerminators, index, to)) {
        return index;
      }
    }
    return trimEnd(source, start, to);
  }

  /** True for "TP.", "V." and an ellipsis followed by a lowercase word: the sentence goes on. */
  private static boolean continuesSentence(
      String source,
      int sentenceStart,
      int runStart,
      int afterTerminators,
      int afterClosers,
      int to) {
    boolean singleDot = afterTerminators - runStart == 1 && source.charAt(runStart) == '.';
    if (singleDot) {
      int wordStart = runStart;
      while (wordStart > sentenceStart && Character.isLetter(source.charAt(wordStart - 1)))
        wordStart--;
      String word = source.substring(wordStart, runStart);
      if (word.length() == 1 && Character.isUpperCase(word.charAt(0))) return true;
      if (ABBREVIATIONS.contains(word.toLowerCase(java.util.Locale.ROOT))) return true;
    }
    boolean ellipsis = source.charAt(runStart) == '…' || afterTerminators - runStart >= 3;
    if (ellipsis) {
      int next = skipWhitespace(source, afterClosers, to);
      return next < to && Character.isLowerCase(source.codePointAt(next));
    }
    return false;
  }

  /**
   * Splits an over-long sentence at clause separators, then at spaces, never inside a surrogate
   * pair.
   */
  private static void splitLong(String source, int start, int end, List<int[]> out) {
    int cursor = start;
    while (end - cursor > MAX_UNIT_CHARS) {
      int limit = cursor + MAX_UNIT_CHARS;
      int floor = cursor + MAX_UNIT_CHARS / 2;
      int cut = -1;
      for (int index = limit - 1; index >= floor && cut < 0; index--) {
        if (CLAUSE_SEPARATORS.indexOf(source.charAt(index)) >= 0
            && Character.isWhitespace(source.charAt(index + 1))) {
          cut = index + 1;
        }
      }
      for (int index = limit; index >= floor && cut < 0; index--) {
        if (Character.isWhitespace(source.charAt(index))) cut = index;
      }
      if (cut < 0) {
        cut = limit;
        if (Character.isHighSurrogate(source.charAt(cut - 1))) cut--;
      }
      int unitEnd = trimEnd(source, cursor, cut);
      if (unitEnd > cursor) out.add(new int[] {cursor, unitEnd});
      cursor = skipWhitespace(source, cut, end);
    }
    if (cursor < end) out.add(new int[] {cursor, trimEnd(source, cursor, end)});
  }

  private static int skipWhitespace(String source, int from, int to) {
    int index = from;
    while (index < to && Character.isWhitespace(source.charAt(index))) index++;
    return index;
  }

  private static int trimEnd(String source, int start, int end) {
    int index = end;
    while (index > start && Character.isWhitespace(source.charAt(index - 1))) index--;
    return index;
  }
}
