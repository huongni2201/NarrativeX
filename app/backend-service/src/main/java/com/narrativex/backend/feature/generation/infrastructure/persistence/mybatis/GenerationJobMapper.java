package com.narrativex.backend.feature.generation.infrastructure.persistence.mybatis;

import com.narrativex.backend.feature.common.infrastructure.persistence.mybatis.NarrativeXMyBatisMapper;
import java.util.UUID;
import org.apache.ibatis.annotations.Param;

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

  Integer acquireImageCapacityLock(@Param("ownerId") String ownerId);

  int countActiveImageJobs(@Param("ownerId") String ownerId);
}
