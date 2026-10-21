package com.narrativex.backend.feature.generation.application.service;

import com.narrativex.backend.feature.generation.domain.value.WordAlignment;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/**
 * Validates the word timing array produced by the WhisperX {@code audio.align} task. The same rules
 * hold wherever it is consumed: contiguous word indexes, monotonic text and audio offsets, and no
 * word ending after the narration audio.
 */
public final class AlignmentWordsParser {
  private static final JsonMapper JSON = JsonMapper.builder().build();

  private AlignmentWordsParser() {}

  public static List<WordAlignment> parse(byte[] payload, long audioDurationMs) {
    return parse(payload, audioDurationMs, 0L);
  }

  /**
   * Forced alignment works on model frames, so the last word may end a few frames after the audio.
   * {@code toleranceMs} bounds how far past the audio a word may end before the output is rejected.
   */
  public static List<WordAlignment> parse(byte[] payload, long audioDurationMs, long toleranceMs) {
    if (payload == null || payload.length == 0) {
      throw new IllegalArgumentException("alignment output is empty");
    }
    try {
      JsonNode root = JSON.readTree(new String(payload, StandardCharsets.UTF_8));
      if (!root.isArray() || root.isEmpty()) {
        throw new IllegalArgumentException("alignment words are missing");
      }
      List<WordAlignment> result = new ArrayList<>();
      int expectedIndex = 0;
      int previousTextEnd = 0;
      long previousAudioEnd = 0;
      for (JsonNode node : root) {
        if (!node.isObject()
            || !node.hasNonNull("index")
            || !node.hasNonNull("textStart")
            || !node.hasNonNull("textEnd")
            || !node.hasNonNull("audioStartMs")
            || !node.hasNonNull("audioEndMs")
            || !node.hasNonNull("confidence")) {
          throw new IllegalArgumentException("alignment word fields are incomplete");
        }
        int index = node.get("index").asInt();
        int textStart = node.get("textStart").asInt();
        int textEnd = node.get("textEnd").asInt();
        long audioStart = node.get("audioStartMs").asLong();
        long audioEnd = node.get("audioEndMs").asLong();
        double confidence = node.get("confidence").asDouble();
        if (index != expectedIndex
            || textStart < previousTextEnd
            || audioStart < previousAudioEnd
            || audioEnd > audioDurationMs + toleranceMs) {
          throw new IllegalArgumentException("alignment words are not monotonic");
        }
        result.add(new WordAlignment(index, textStart, textEnd, audioStart, audioEnd, confidence));
        previousTextEnd = textEnd;
        previousAudioEnd = audioEnd;
        expectedIndex++;
      }
      return List.copyOf(result);
    } catch (RuntimeException exception) {
      if (exception instanceof IllegalArgumentException) throw exception;
      throw new IllegalArgumentException("alignment output is invalid", exception);
    }
  }
}
