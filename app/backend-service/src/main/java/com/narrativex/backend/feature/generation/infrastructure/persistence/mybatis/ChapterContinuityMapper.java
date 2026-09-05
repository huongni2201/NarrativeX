package com.narrativex.backend.feature.generation.infrastructure.persistence.mybatis;

import com.narrativex.backend.feature.common.infrastructure.persistence.mybatis.NarrativeXMyBatisMapper;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.apache.ibatis.annotations.Param;

public interface ChapterContinuityMapper extends NarrativeXMyBatisMapper {
  CurrentContinuityRow findCurrent(
      @Param("projectId") UUID projectId, @Param("chapterId") UUID chapterId);

  List<ContinuityBeatLineageRow> findBeatLineage(@Param("planId") UUID planId);

  int insertRegenerationPlan(
      @Param("id") UUID id,
      @Param("projectId") UUID projectId,
      @Param("chapterId") UUID chapterId,
      @Param("continuityPlanId") UUID continuityPlanId,
      @Param("sourceHash") String sourceHash,
      @Param("requestedBeatIdsJson") String requestedBeatIdsJson,
      @Param("affectedBeatIdsJson") String affectedBeatIdsJson,
      @Param("reusableBeatIdsJson") String reusableBeatIdsJson,
      @Param("reason") String reason,
      @Param("estimatedCost") BigDecimal estimatedCost,
      @Param("currency") String currency,
      @Param("expiresAt") Instant expiresAt,
      @Param("inputFingerprint") String inputFingerprint,
      @Param("createdBy") String createdBy);

  RegenerationPlanRow findRegenerationPlan(
      @Param("projectId") UUID projectId,
      @Param("chapterId") UUID chapterId,
      @Param("planId") UUID planId);

  RegenerationPlanRow findRegenerationPlanByFingerprint(
      @Param("projectId") UUID projectId,
      @Param("chapterId") UUID chapterId,
      @Param("inputFingerprint") String inputFingerprint);

  MediaGenerationSettingsRow findLatestMediaSettings(@Param("chapterId") UUID chapterId);

  int bindRegenerationJob(
      @Param("generationJobId") UUID generationJobId,
      @Param("regenerationPlanId") UUID regenerationPlanId);

  UUID findRegenerationPlanIdForJob(@Param("generationJobId") UUID generationJobId);

  int nextReportRevision(@Param("continuityPlanId") UUID continuityPlanId);

  int insertHumanReport(
      @Param("continuityPlanId") UUID continuityPlanId,
      @Param("revision") int revision,
      @Param("status") String status,
      @Param("issuesJson") String issuesJson,
      @Param("reviewedBy") String reviewedBy);
}
