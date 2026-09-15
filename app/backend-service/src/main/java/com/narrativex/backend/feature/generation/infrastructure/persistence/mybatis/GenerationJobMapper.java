package com.narrativex.backend.feature.generation.infrastructure.persistence.mybatis;

import com.narrativex.backend.feature.common.infrastructure.persistence.mybatis.NarrativeXMyBatisMapper;
import java.util.UUID;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

public interface GenerationJobMapper extends NarrativeXMyBatisMapper {
  UUID insert(GenerationJobRow row);

  int updateCas(GenerationJobRow row);

  GenerationJobRow findById(@Param("id") UUID id);

  GenerationJobRow findByJobId(@Param("jobId") UUID jobId);

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
         AND status IN ('QUEUED', 'RUNNING', 'UNKNOWN', 'STALLED')
      """)
  int countActiveImageJobs();

  @Select(
      """
      SELECT COUNT(*)::int
        FROM generation_jobs
       WHERE status IN ('QUEUED', 'RUNNING', 'UNKNOWN', 'STALLED')
      """)
  int countActiveJobs();
}
