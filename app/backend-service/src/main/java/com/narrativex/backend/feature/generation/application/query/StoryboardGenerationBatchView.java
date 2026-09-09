package com.narrativex.backend.feature.generation.application.query;

import com.narrativex.backend.feature.generation.application.port.out.StoryboardGenerationSnapshotRepository.BeatSnapshot;
import com.narrativex.backend.feature.generation.application.port.out.StoryboardGenerationSnapshotRepository.GenerationBatch;
import java.util.List;
import java.util.UUID;

public record StoryboardGenerationBatchView(
    UUID id,
    UUID storyboardRevisionId,
    String sourceHash,
    UUID continuityPlanId,
    Integer continuityPlanRevision,
    Integer continuityReportRevision,
    String stylePolicyVersion,
    String providerPolicyVersion,
    String requestFingerprint,
    List<BeatView> beats) {
  public static StoryboardGenerationBatchView from(GenerationBatch batch) {
    return new StoryboardGenerationBatchView(
        batch.id(),
        batch.storyboardRevisionId(),
        batch.sourceHash(),
        batch.continuityPlanId(),
        batch.continuityPlanRevision(),
        batch.continuityReportRevision(),
        batch.stylePolicyVersion(),
        batch.providerPolicyVersion(),
        batch.requestFingerprint(),
        batch.beats().stream().map(BeatView::from).toList());
  }

  public record BeatView(
      UUID id,
      UUID visualBeatId,
      UUID sceneId,
      long beatRowVersion,
      String prompt,
      String negativePrompt,
      String characterSnapshotJson,
      String referencesJson,
      String continuitySemanticHash,
      String inputFingerprint) {
    private static BeatView from(BeatSnapshot beat) {
      return new BeatView(
          beat.id(),
          beat.visualBeatId(),
          beat.sceneId(),
          beat.beatRowVersion(),
          beat.prompt(),
          beat.negativePrompt(),
          beat.characterSnapshotJson(),
          beat.referencesJson(),
          beat.continuitySemanticHash(),
          beat.inputFingerprint());
    }
  }
}
