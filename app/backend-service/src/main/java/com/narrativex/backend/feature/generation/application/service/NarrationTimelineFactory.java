package com.narrativex.backend.feature.generation.application.service;

import com.narrativex.backend.feature.generation.domain.enums.AlignmentStatus;
import com.narrativex.backend.feature.generation.domain.value.NarrationDocument;
import com.narrativex.backend.feature.generation.domain.value.NarrationPartSnapshot;
import com.narrativex.backend.feature.generation.domain.value.NarrationPartTimeline;
import com.narrativex.backend.feature.generation.domain.value.NarrationSpan;
import com.narrativex.backend.feature.generation.domain.value.NarrationTimeline;
import java.util.List;
import java.util.Objects;
import java.util.UUID;
import org.springframework.stereotype.Component;

/** Builds the logical concatenation consumed by visual planning without joining physical files. */
@Component
public class NarrationTimelineFactory {
  public NarrationTimeline create(
      NarrationDocument document,
      UUID narrationSetId,
      String narrationFingerprint,
      List<NarrationPartSnapshot> parts,
      List<NarrationSpan> spans,
      double confidence,
      double readyCoverageThreshold,
      double readyConfidenceThreshold) {
    Objects.requireNonNull(document, "document");
    Objects.requireNonNull(narrationSetId, "narrationSetId");
    Objects.requireNonNull(narrationFingerprint, "narrationFingerprint");
    parts = List.copyOf(Objects.requireNonNull(parts, "parts"));
    spans = List.copyOf(Objects.requireNonNull(spans, "spans"));
    if (readyCoverageThreshold < 0 || readyCoverageThreshold > 1)
      throw new IllegalArgumentException("invalid coverage threshold");
    if (readyConfidenceThreshold < 0 || readyConfidenceThreshold > 1)
      throw new IllegalArgumentException("invalid confidence threshold");

    long cursor = 0;
    List<NarrationPartTimeline> partTimeline = new java.util.ArrayList<>();
    for (int index = 0; index < parts.size(); index++) {
      NarrationPartSnapshot part = parts.get(index);
      if (part.sequence() != index)
        throw new IllegalArgumentException("part sequences must be contiguous from zero");
      long end = cursor + part.durationMs();
      partTimeline.add(
          new NarrationPartTimeline(part.mediaAssetId(), index, cursor, end, part.durationMs()));
      cursor = end;
    }
    if (cursor <= 0) throw new IllegalArgumentException("at least one audio part is required");

    validateSpans(spans, cursor);
    int selectedLength = document.selectedTextLength();
    int alignedLength =
        spans.stream().mapToInt(span -> span.globalTextEnd() - span.globalTextStart()).sum();
    double coverage =
        selectedLength == 0 ? 0 : Math.min(1d, (double) alignedLength / selectedLength);
    AlignmentStatus status =
        classify(
            spans,
            document,
            coverage,
            confidence,
            readyCoverageThreshold,
            readyConfidenceThreshold);
    return new NarrationTimeline(
        document.id(),
        narrationSetId,
        document.documentFingerprint(),
        narrationFingerprint,
        cursor,
        partTimeline,
        spans,
        coverage,
        confidence,
        status);
  }

  private static AlignmentStatus classify(
      List<NarrationSpan> spans,
      NarrationDocument document,
      double coverage,
      double confidence,
      double readyCoverageThreshold,
      double readyConfidenceThreshold) {
    if (hasTextGap(spans, document.selectedTextLength())) return AlignmentStatus.GAP_DETECTED;
    if (spans.isEmpty()) return AlignmentStatus.INCOMPLETE;
    int maxTextEnd = document.chapters().getLast().globalTextEnd();
    if (spans.getLast().globalTextEnd() > maxTextEnd) return AlignmentStatus.EXTRA_AUDIO;
    if (coverage < readyCoverageThreshold) return AlignmentStatus.INCOMPLETE;
    if (confidence < readyConfidenceThreshold) return AlignmentStatus.LOW_CONFIDENCE;
    return AlignmentStatus.READY;
  }

  private static boolean hasTextGap(List<NarrationSpan> spans, int selectedLength) {
    if (spans.isEmpty()) return selectedLength > 0;
    int cursor = spans.getFirst().globalTextStart();
    if (cursor > 0) return true;
    for (NarrationSpan span : spans) {
      if (span.globalTextStart() > cursor) return true;
      cursor = Math.max(cursor, span.globalTextEnd());
    }
    return cursor < selectedLength;
  }

  private static void validateSpans(List<NarrationSpan> spans, long totalDurationMs) {
    long previousAudioEnd = 0;
    int previousTextEnd = 0;
    for (NarrationSpan span : spans) {
      if (span.globalAudioStartMs() < previousAudioEnd)
        throw new IllegalArgumentException("audio spans overlap");
      if (span.globalTextStart() < previousTextEnd)
        throw new IllegalArgumentException("text spans overlap");
      if (span.globalAudioEndMs() > totalDurationMs)
        throw new IllegalArgumentException("audio span exceeds narration duration");
      previousAudioEnd = span.globalAudioEndMs();
      previousTextEnd = span.globalTextEnd();
    }
  }
}
