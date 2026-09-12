package com.narrativex.backend.feature.generation.application.service;

import java.util.ArrayList;
import java.util.List;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/** Maps UTF-16 source offsets onto the authoritative narration word clock. */
public final class NarrationTextClockMapper {
  private static final JsonMapper JSON = JsonMapper.builder().build();
  private static final long HARD_MAX_VISUAL_BEAT_MS = 10_000L;

  private NarrationTextClockMapper() {}

  public record TextRange(int textStart, int textEnd) {}

  public record AudioRange(long audioStartMs, long audioEndMs) {
    public long durationMs() {
      return audioEndMs - audioStartMs;
    }
  }

  private record WordAlignment(int textStart, int textEnd, long audioStartMs, long audioEndMs) {}

  public static List<AudioRange> map(
      List<TextRange> ranges, String wordsJson, long audioDurationMs) {
    if (ranges.isEmpty() || wordsJson == null || wordsJson.isBlank() || audioDurationMs <= 0) {
      return List.of();
    }
    List<WordAlignment> words = parseWords(wordsJson, audioDurationMs);
    if (words.isEmpty()) return List.of();

    List<Long> starts = new ArrayList<>(ranges.size());
    starts.add(0L);
    for (int index = 1; index < ranges.size(); index++) {
      Long mapped = mapStartOffset(ranges.get(index).textStart(), words);
      if (mapped == null) return List.of();
      starts.add(mapped);
    }

    for (int index = 1; index < starts.size(); index++) {
      if (starts.get(index) <= starts.get(index - 1) || starts.get(index) >= audioDurationMs) {
        return List.of();
      }
    }

    List<AudioRange> result = new ArrayList<>(ranges.size());
    for (int index = 0; index < starts.size(); index++) {
      long start = starts.get(index);
      long end = index + 1 < starts.size() ? starts.get(index + 1) : audioDurationMs;
      if (end <= start || end - start > HARD_MAX_VISUAL_BEAT_MS) return List.of();
      result.add(new AudioRange(start, end));
    }
    return List.copyOf(result);
  }

  private static List<WordAlignment> parseWords(String wordsJson, long audioDurationMs) {
    try {
      JsonNode root = JSON.readTree(wordsJson);
      if (!root.isArray() || root.isEmpty()) return List.of();
      List<WordAlignment> words = new ArrayList<>();
      long previousAudioEnd = 0L;
      int previousTextEnd = 0;
      int expectedIndex = 0;
      for (JsonNode node : root) {
        if (!node.hasNonNull("index")
            || !node.hasNonNull("textStart")
            || !node.hasNonNull("textEnd")
            || !node.hasNonNull("audioStartMs")
            || !node.hasNonNull("audioEndMs")
            || !node.hasNonNull("confidence")) {
          return List.of();
        }
        int index = node.get("index").asInt();
        int textStart = node.get("textStart").asInt();
        int textEnd = node.get("textEnd").asInt();
        long audioStart = node.get("audioStartMs").asLong();
        long audioEnd = node.get("audioEndMs").asLong();
        double confidence = node.get("confidence").asDouble();
        if (index != expectedIndex
            || textStart < previousTextEnd
            || textEnd <= textStart
            || audioStart < previousAudioEnd
            || audioEnd <= audioStart
            || audioEnd > audioDurationMs
            || confidence < 0.0
            || confidence > 1.0) {
          return List.of();
        }
        words.add(new WordAlignment(textStart, textEnd, audioStart, audioEnd));
        previousTextEnd = textEnd;
        previousAudioEnd = audioEnd;
        expectedIndex += 1;
      }
      return List.copyOf(words);
    } catch (Exception ignored) {
      return List.of();
    }
  }

  private static Long mapStartOffset(int offset, List<WordAlignment> words) {
    WordAlignment previous = null;
    for (WordAlignment word : words) {
      if (offset <= word.textEnd()) {
        return word.audioStartMs();
      }
      previous = word;
    }
    return previous == null ? null : previous.audioEndMs();
  }
}
