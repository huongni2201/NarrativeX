package com.narrativex.backend.feature.generation.infrastructure.persistence.mybatis;

import com.narrativex.backend.feature.common.infrastructure.persistence.mybatis.NarrativeXMyBatisMapper;
import java.util.UUID;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

public interface GenerationJobMapper extends NarrativeXMyBatisMapper {
  UUID insert(GenerationJobRow row);

  int updateCas(GenerationJobRow row);

  GenerationJobRow findById(@Param("id") UUID id);

  GenerationJobRow findByIdAndOwner(@Param("id") UUID id, @Param("ownerId") String ownerId);

  GenerationJobRow findByJobIdAndOwner(
      @Param("jobId") UUID jobId, @Param("ownerId") String ownerId);

  AnalysisProgressRow findAnalysisProgressByJobIdAndOwner(
      @Param("jobId") UUID jobId, @Param("ownerId") String ownerId);

  GenerationJobRow findByIdempotencyKey(
      @Param("idempotencyKey") String idempotencyKey, @Param("ownerId") String ownerId);

  GenerationJobRow findLatestByIdempotencyFamily(
      @Param("baseIdempotencyKey") String baseIdempotencyKey, @Param("ownerId") String ownerId);

  Integer acquireIdempotencyLock(
      @Param("idempotencyKey") String idempotencyKey, @Param("ownerId") String ownerId);

  @Select(
      "SELECT 1 FROM pg_advisory_xact_lock(hashtextextended(CONCAT('image-capacity:', #{ownerId}), 0))")
  Integer acquireImageCapacityLock(@Param("ownerId") String ownerId);

  @Select(
      """
      SELECT COUNT(*)::int
        FROM generation_jobs
       WHERE requested_by_user_id = #{ownerId}
         AND job_type = 'CHAPTER_GENERATE'
         AND production_mode = 'IMAGE_MOTION'
         AND resource_class = 'PROVIDER_BATCH'
         AND status IN ('QUEUED', 'RUNNING', 'UNKNOWN', 'STALLED')
      """)
  int countActiveImageJobs(@Param("ownerId") String ownerId);
}
