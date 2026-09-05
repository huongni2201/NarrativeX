package com.narrativex.backend.feature.generation.infrastructure.persistence.mybatis;

import com.narrativex.backend.feature.common.infrastructure.persistence.mybatis.NarrativeXMyBatisMapper;
import java.util.UUID;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

public interface GenerationJobMapper extends NarrativeXMyBatisMapper {
  UUID insert(GenerationJobRow row);

  int updateCas(GenerationJobRow row);

  GenerationJobRow findById(@Param("id") UUID id);

  GenerationJobRow findByIdAndOwner(@Param("id") UUID id, @Param("ownerId") String ownerId);

  GenerationJobRow findByJobIdAndOwner(
      @Param("jobId") UUID jobId, @Param("ownerId") String ownerId);

  GenerationJobRow findByIdempotencyKey(
      @Param("idempotencyKey") String idempotencyKey, @Param("ownerId") String ownerId);

  GenerationJobRow findLatestByIdempotencyFamily(
      @Param("baseIdempotencyKey") String baseIdempotencyKey, @Param("ownerId") String ownerId);

  @Select("SELECT request_fingerprint FROM generation_jobs WHERE id = #{id}")
  String findRequestFingerprint(@Param("id") UUID id);

  @Update(
      "UPDATE generation_jobs SET request_fingerprint = #{requestFingerprint} WHERE id = #{id}")
  int setRequestFingerprint(
      @Param("id") UUID id, @Param("requestFingerprint") String requestFingerprint);

  Integer acquireIdempotencyLock(
      @Param("idempotencyKey") String idempotencyKey, @Param("ownerId") String ownerId);
}
