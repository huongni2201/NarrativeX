package com.narrativex.backend.feature.assets.infrastructure.persistence.mybatis;

import com.narrativex.backend.feature.common.infrastructure.persistence.mybatis.NarrativeXMyBatisMapper;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.apache.ibatis.annotations.Param;

public interface MediaStorageCleanupTaskMapper extends NarrativeXMyBatisMapper {
  int enqueue(
      @Param("id") UUID id,
      @Param("storageKey") String storageKey,
      @Param("reason") String reason,
      @Param("nextAttemptAt") Instant nextAttemptAt);

  List<MediaStorageCleanupTaskRow> claimDue(
      @Param("now") Instant now,
      @Param("leaseUntil") Instant leaseUntil,
      @Param("limit") int limit);

  int markCompleted(@Param("id") UUID id, @Param("completedAt") Instant completedAt);

  int markFailed(
      @Param("id") UUID id,
      @Param("nextAttemptAt") Instant nextAttemptAt,
      @Param("lastError") String lastError);
}
