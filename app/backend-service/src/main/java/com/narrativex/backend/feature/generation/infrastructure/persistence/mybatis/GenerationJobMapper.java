package com.narrativex.backend.feature.generation.infrastructure.persistence.mybatis;

import com.narrativex.backend.feature.common.infrastructure.persistence.mybatis.NarrativeXMyBatisMapper;
import org.apache.ibatis.annotations.Param;

public interface GenerationJobMapper extends NarrativeXMyBatisMapper {
  Long insert(GenerationJobRow row);

  int updateCas(GenerationJobRow row);

  GenerationJobRow findById(@Param("id") Long id);

  GenerationJobRow findByJobIdAndOwner(
      @Param("jobId") String jobId, @Param("ownerId") String ownerId);

  GenerationJobRow findByIdempotencyKey(@Param("idempotencyKey") String idempotencyKey);

  Integer acquireIdempotencyLock(@Param("idempotencyKey") String idempotencyKey);
}
