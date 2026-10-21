package com.narrativex.backend.feature.generation.application.service;

import java.util.List;
import java.util.Locale;
import java.util.Objects;

/** Provisional speech-duration estimate used only to validate Native AV Shot inputs. */
public final class NativeDialogueDurationEstimator {
  public static final String VERSION = "NATIVE_DIALOGUE_DURATION_ESTIMATE_V1";

  private static final long INTER_CUE_PAUSE_MS = 300L;

  private NativeDialogueDurationEstimator() {}

  public static long estimateMs(List<String> dialogueTexts, String language) {
    List<String> lines =
        dialogueTexts == null
            ? List.of()
            : dialogueTexts.stream()
                .filter(Objects::nonNull)
                .filter(text -> !text.isBlank())
                .toList();
    if (lines.isEmpty()) return 0L;

    String languageCode =
        language == null ? "" : language.toLowerCase(Locale.ROOT).split("[-_]", 2)[0];
    int charactersPerSecond =
        switch (languageCode) {
          case "en" -> 15;
          case "vi" -> 12;
          default -> 10;
        };
    long speechMs =
        lines.stream()
            .mapToLong(
                text ->
                    (long)
                        Math.ceil(
                            text.codePointCount(0, text.length()) * 1_000.0 / charactersPerSecond))
            .sum();
    return speechMs + (lines.size() - 1L) * INTER_CUE_PAUSE_MS;
  }

  public static long roundUpToFrame(long durationMs, int framesPerSecond) {
    if (durationMs <= 0L) return 0L;
    if (framesPerSecond <= 0)
      throw new IllegalArgumentException("framesPerSecond must be positive");
    long frames = (durationMs * framesPerSecond + 999L) / 1_000L;
    return (frames * 1_000L + framesPerSecond - 1L) / framesPerSecond;
  }
}
