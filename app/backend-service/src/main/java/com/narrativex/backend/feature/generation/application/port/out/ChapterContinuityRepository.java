package com.narrativex.backend.feature.generation.application.port.out;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/** Backend-authoritative persistence boundary for continuity reports and regeneration plans. */
public interface ChapterContinuityRepository {
  Optional<CurrentContinuity> findCurrent(UUID projectId, UUID chapterId);

  List<BeatLineage> findBeatLineage(UUID planId);

  RegenerationPlan saveRegenerationPlan(RegenerationPlan plan);

  Optional<RegenerationPlan> findRegenerationPlan(UUID projectId, UUID chapterId, UUID planId);

  Optional<RegenerationPlan> findRegenerationPlanByFingerprint(
      UUID projectId, UUID chapterId, String inputFingerprint);

  Optional<MediaGenerationSettings> findLatestMediaSettings(UUID chapterId);

  void bindRegenerationJob(UUID generationJobId, UUID regenerationPlanId);

  Optional<UUID> findRegenerationPlanIdForJob(UUID generationJobId);

  int nextReportRevision(UUID continuityPlanId);

  void appendHumanReport(
      UUID continuityPlanId, int revision, String status, String issuesJson, String reviewedBy);

  record CurrentContinuity(
      UUID planId,
      int planRevision,
      String sourceHash,
      String reportStatus,
      int reportRevision,
      String issuesJson) {}

  record BeatLineage(
      UUID visualBeatId,
      UUID sceneId,
      int sceneOrderIndex,
      int beatOrderIndex,
      String semanticHash) {}

  record MediaGenerationSettings(
      String aspectRatio,
      String imageStyle,
      String providerKey,
      String modelKey,
      String pricingSnapshotJson,
      String pricingFingerprint) {}

  record RegenerationPlan(
      UUID id,
      UUID projectId,
      UUID chapterId,
      UUID continuityPlanId,
      String sourceHash,
      List<UUID> requestedBeatIds,
      List<UUID> affectedBeatIds,
      List<UUID> reusableBeatIds,
      String reason,
      BigDecimal estimatedCost,
      String currency,
      Instant expiresAt,
      String inputFingerprint,
      String createdBy) {
    public RegenerationPlan {
      requestedBeatIds = List.copyOf(requestedBeatIds);
      affectedBeatIds = List.copyOf(affectedBeatIds);
      reusableBeatIds = List.copyOf(reusableBeatIds);
    }
  }
}
