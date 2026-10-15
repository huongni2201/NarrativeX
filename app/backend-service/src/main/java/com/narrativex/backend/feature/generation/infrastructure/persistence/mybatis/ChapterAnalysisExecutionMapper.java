package com.narrativex.backend.feature.generation.infrastructure.persistence.mybatis;

import com.narrativex.backend.feature.common.infrastructure.persistence.mybatis.NarrativeXMyBatisMapper;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

public interface ChapterAnalysisExecutionMapper extends NarrativeXMyBatisMapper {
  @Select(
      """
      SELECT j.job_id FROM generation_jobs j
      JOIN chapter_analysis_execution_snapshots s ON s.generation_job_id = j.id
      WHERE j.status = 'QUEUED' AND j.job_type = 'CHAPTER_ANALYZE'
        AND s.execution_mode = 'ANTIGRAVITY_CLI'
      ORDER BY j.created_at, j.id LIMIT 1
      """)
  UUID findNextQueuedLocalJob();

  @Select("SELECT count(*) FROM chapter_analysis_execution_attempts WHERE slot_held")
  int countHeldLocalSlots();

  @Select(
      """
      SELECT attempt_id FROM chapter_analysis_execution_attempts
      WHERE slot_held AND lease_expires_at < #{now} AND checkpoint <> 'UNKNOWN' LIMIT 50
      """)
  List<UUID> findExpiredLocalAttempts(@Param("now") Instant now);

  AnalysisRuntimeConfigurationRow findRuntimeConfiguration();

  int updateRuntimeConfiguration(
      @Param("row") AnalysisRuntimeConfigurationRow row,
      @Param("expectedRowVersion") long expectedRowVersion);

  AnalysisProviderCredentialRow findCredential(@Param("credentialRef") UUID credentialRef);

  AnalysisProviderCredentialRow findCredentialByDevice(@Param("deviceId") UUID deviceId);

  int insertCredential(AnalysisProviderCredentialRow row);

  int updateCredential(
      @Param("row") AnalysisProviderCredentialRow row,
      @Param("expectedRowVersion") long expectedRowVersion);

  int insertSnapshot(ChapterAnalysisExecutionSnapshotRow row);

  ChapterAnalysisExecutionSnapshotRow findSnapshot(@Param("generationJobId") UUID generationJobId);

  int insertAttempt(ChapterAnalysisExecutionAttemptRow row);

  ChapterAnalysisExecutionAttemptRow findAttempt(@Param("attemptId") UUID attemptId);

  ChapterAnalysisExecutionAttemptRow findAttemptByClaimRequest(
      @Param("deviceId") UUID deviceId, @Param("claimRequestId") UUID claimRequestId);

  ChapterAnalysisExecutionAttemptRow findActiveAttempt(
      @Param("generationJobId") UUID generationJobId);

  int updateAttempt(
      @Param("row") ChapterAnalysisExecutionAttemptRow row,
      @Param("expectedRowVersion") long expectedRowVersion,
      @Param("expectedFencingToken") long expectedFencingToken);
}
