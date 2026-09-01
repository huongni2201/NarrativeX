package com.narrativex.backend.feature.generation.application.service;

import java.util.ArrayList;
import java.util.List;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/** Maps UTF-16 source offsets onto the authoritative narration alignment clock. */
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

  private record AlignmentSpan(int textStart, int textEnd, long audioStartMs, long audioEndMs) {}

  public static List<AudioRange> map(
      List<TextRange> ranges, String spansJson, long audioDurationMs) {
    if (ranges.isEmpty() || spansJson == null || spansJson.isBlank() || audioDurationMs <= 0) {
      return List.of();
    }
    List<AlignmentSpan> spans = parseSpans(spansJson);
    if (spans.isEmpty()) return List.of();

    List<Long> starts = new ArrayList<>(ranges.size());
    starts.add(0L);
    for (int index = 1; index < ranges.size(); index++) {
      Long mapped = mapOffset(ranges.get(index).textStart(), spans);
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

  private static List<AlignmentSpan> parseSpans(String spansJson) {
    try {
      JsonNode root = JSON.readTree(spansJson);
      if (!root.isArray() || root.isEmpty()) return List.of();
      List<AlignmentSpan> spans = new ArrayList<>();
      long previousAudioEnd = 0L;
      int previousTextEnd = 0;
      for (JsonNode node : root) {
        if (!node.hasNonNull("textStart")
            || !node.hasNonNull("textEnd")
            || !node.hasNonNull("audioStartMs")
            || !node.hasNonNull("audioEndMs")) {
          return List.of();
        }
        int textStart = node.get("textStart").asInt();
        int textEnd = node.get("textEnd").asInt();
        long audioStart = node.get("audioStartMs").asLong();
        long audioEnd = node.get("audioEndMs").asLong();
        if (textStart < previousTextEnd
            || textEnd <= textStart
            || audioStart < previousAudioEnd
            || audioEnd <= audioStart) {
          return List.of();
        }
        spans.add(new AlignmentSpan(textStart, textEnd, audioStart, audioEnd));
        previousTextEnd = textEnd;
        previousAudioEnd = audioEnd;
      }
      return List.copyOf(spans);
    } catch (Exception ignored) {
      return List.of();
    }
  }

  private static Long mapOffset(int offset, List<AlignmentSpan> spans) {
    for (AlignmentSpan span : spans) {
      if (offset >= span.textStart() && offset <= span.textEnd()) {
        long textWidth = span.textEnd() - span.textStart();
        long audioWidth = span.audioEndMs() - span.audioStartMs();
        long relative = offset - span.textStart();
        return span.audioStartMs() + Math.round((double) relative * audioWidth / textWidth);
      }
    }
    return null;
  }
}
