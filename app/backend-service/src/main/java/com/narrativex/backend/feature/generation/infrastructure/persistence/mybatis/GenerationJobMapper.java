package com.narrativex.backend.feature.generation.infrastructure.persistence.mybatis;

import com.narrativex.backend.feature.common.infrastructure.persistence.mybatis.NarrativeXMyBatisMapper;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

public interface GenerationJobMapper extends NarrativeXMyBatisMapper {
  UUID insert(GenerationJobRow row);

  int updateCas(GenerationJobRow row);

  GenerationJobRow findById(@Param("id") UUID id);

  GenerationJobRow findByJobId(@Param("jobId") UUID jobId);

  GenerationJobRow findByComputeAttemptId(
      @Param("taskId") UUID taskId, @Param("attemptId") UUID attemptId);

  List<GenerationJobRow> findJobsDueForReconciliation(
      @Param("now") Instant now, @Param("limit") int limit);

  List<GenerationJobRow> findActiveChapterVideoBatches(@Param("limit") int limit);

  AnalysisProgressRow findAnalysisProgressByJobId(@Param("jobId") UUID jobId);

  GenerationJobRow findByIdempotencyKey(@Param("idempotencyKey") String idempotencyKey);

  GenerationJobRow findLatestByIdempotencyFamily(
      @Param("baseIdempotencyKey") String baseIdempotencyKey);

  Integer acquireIdempotencyLock(@Param("idempotencyKey") String idempotencyKey);

  @Select("SELECT 1 FROM pg_advisory_xact_lock(hashtextextended('image-capacity', 0))")
  Integer acquireImageCapacityLock();

  @Select("SELECT 1 FROM pg_advisory_xact_lock(hashtextextended('analysis-capacity', 0))")
  Integer acquireAnalysisCapacityLock();

  @Select(
      """
      SELECT COUNT(*)::int
        FROM generation_jobs
       WHERE job_type = 'CHAPTER_GENERATE'
         AND production_mode = 'IMAGE_MOTION'
         AND resource_class = 'PROVIDER_BATCH'
         AND status IN ('QUEUED', 'SUBMITTING', 'SUBMITTED', 'RUNNING', 'UNKNOWN', 'RECONCILING', 'STALLED')
      """)
  int countActiveImageJobs();

  @Select(
      """
      SELECT COUNT(*)::int
        FROM generation_jobs
       WHERE NOT (job_type = 'CHAPTER_GENERATE' AND production_mode = 'VIDEO_FIRST' AND resource_class = 'BACKGROUND' AND media_plan_id IS NOT NULL)
         AND status IN ('QUEUED', 'SUBMITTING', 'SUBMITTED', 'RUNNING', 'UNKNOWN', 'RECONCILING', 'STALLED')
      """)
  int countActiveJobs();

  @Select(
      """
      SELECT COUNT(*)::int FROM generation_jobs
      WHERE job_type = 'CHAPTER_GENERATE' AND (production_mode = 'VIDEO_FIRST' OR resource_class = 'GPU_HEAVY')
        AND NOT (resource_class = 'BACKGROUND' AND production_mode = 'VIDEO_FIRST' AND media_plan_id IS NOT NULL)
        AND status IN ('SUBMITTING', 'SUBMITTED', 'RUNNING', 'UNKNOWN', 'RECONCILING', 'STALLED')
      """)
  int countActiveVideoExecutions();
}
