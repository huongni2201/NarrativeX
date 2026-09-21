package com.narrativex.backend.feature.generation.application.service;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.UUID;
import org.springframework.stereotype.Service;

/**
 * Generates an authoritative EditDecisionList (EDL) from approved SelectedTakes and the master
 * narration audio clock according to ADR-0030. In/Out trimming ensures generated clip duration does
 * not equal timeline edit duration.
 */
@Service
public class EditingDirector {

  public record SelectedTakeCut(
      UUID shotId,
      UUID takeId,
      UUID mediaAssetId,
      long sourceInMs,
      long sourceOutMs,
      String transitionType,
      long transitionDurationMs) {

    public SelectedTakeCut {
      Objects.requireNonNull(shotId, "shotId must not be null");
      Objects.requireNonNull(takeId, "takeId must not be null");
      Objects.requireNonNull(mediaAssetId, "mediaAssetId must not be null");
      if (sourceOutMs <= sourceInMs) {
        throw new IllegalArgumentException("sourceOutMs must be strictly greater than sourceInMs");
      }
    }

    public long editDurationMs() {
      return sourceOutMs - sourceInMs;
    }
  }

  public record CompiledEditDecision(
      UUID decisionId,
      int orderIndex,
      UUID shotId,
      UUID takeId,
      UUID mediaAssetId,
      long sourceInMs,
      long sourceOutMs,
      long timelineInMs,
      long timelineOutMs,
      String transitionType,
      long transitionDurationMs) {}

  public record CompiledEditDecisionList(
      String schemaVersion,
      UUID projectId,
      UUID storyVersionId,
      UUID chapterId,
      long totalDurationMs,
      int fps,
      int width,
      int height,
      String audioClockSource,
      UUID audioAssetId,
      List<CompiledEditDecision> decisions) {}

  /**
   * Compiles an EditDecisionList from an ordered sequence of selected takes and master audio clock.
   */
  public CompiledEditDecisionList assembleEditDecisionList(
      UUID projectId,
      UUID storyVersionId,
      UUID chapterId,
      UUID audioAssetId,
      long audioMasterDurationMs,
      List<SelectedTakeCut> cuts) {
    Objects.requireNonNull(projectId, "projectId must not be null");
    Objects.requireNonNull(chapterId, "chapterId must not be null");
    Objects.requireNonNull(audioAssetId, "audioAssetId must not be null");
    Objects.requireNonNull(cuts, "cuts must not be null");

    List<CompiledEditDecision> decisions = new ArrayList<>();
    long currentTimelineMs = 0L;

    for (int i = 0; i < cuts.size(); i++) {
      SelectedTakeCut cut = cuts.get(i);
      long duration = cut.editDurationMs();
      long timelineIn = currentTimelineMs;
      long timelineOut = currentTimelineMs + duration;

      decisions.add(
          new CompiledEditDecision(
              UUID.randomUUID(),
              i,
              cut.shotId(),
              cut.takeId(),
              cut.mediaAssetId(),
              cut.sourceInMs(),
              cut.sourceOutMs(),
              timelineIn,
              timelineOut,
              cut.transitionType() != null ? cut.transitionType() : "CUT",
              cut.transitionDurationMs()));

      currentTimelineMs = timelineOut;
    }

    long finalDuration = Math.max(currentTimelineMs, audioMasterDurationMs);

    return new CompiledEditDecisionList(
        "1.0",
        projectId,
        storyVersionId,
        chapterId,
        finalDuration,
        24,
        1280,
        720,
        "VIENEU_MASTER",
        audioAssetId,
        decisions);
  }
}
