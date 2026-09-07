package com.narrativex.backend.feature.generation.application.port.out;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/** Immutable backend snapshot boundary for Desktop Gemini Web storyboard generation. */
public interface StoryboardGenerationSnapshotRepository {
  Optional<ChapterScope> findCurrentScope(UUID projectId, UUID chapterId);

  Optional<GenerationBatch> findByIdempotencyKey(
      UUID projectId, UUID chapterId, String idempotencyKey);

  Optional<GenerationBatch> findById(UUID projectId, UUID chapterId, UUID batchId);

  GenerationBatch save(GenerationBatch batch);

  record ChapterScope(UUID storyboardRevisionId, String sourceHash) {}

  record GenerationBatch(
      UUID id,
      UUID projectId,
      UUID chapterId,
      UUID storyboardRevisionId,
      String sourceHash,
      UUID continuityPlanId,
      Integer continuityPlanRevision,
      Integer continuityReportRevision,
      String stylePolicyVersion,
      String providerPolicyVersion,
      String idempotencyKey,
      String requestFingerprint,
      String issuesJson,
      String status,
      Instant createdAt,
      List<BeatSnapshot> beats) {
    public GenerationBatch {
      beats = beats == null ? List.of() : List.copyOf(beats);
    }
  }

  record BeatSnapshot(
      UUID id,
      UUID visualBeatId,
      UUID sceneId,
      long beatRowVersion,
      String prompt,
      String negativePrompt,
      String characterSnapshotJson,
      String referencesJson,
      String continuitySemanticHash,
      String inputFingerprint) {}
}
