package com.narrativex.backend.feature.project.infrastructure.persistence.mybatis;

import com.narrativex.backend.feature.common.infrastructure.persistence.mybatis.NarrativeXMyBatisMapper;
import java.util.UUID;
import org.apache.ibatis.annotations.Param;

public interface ChapterCreationIdempotencyMapper extends NarrativeXMyBatisMapper {
  ChapterCreationIdempotencyRow reserve(
      @Param("ownerId") String ownerId,
      @Param("projectId") UUID projectId,
      @Param("idempotencyKey") String idempotencyKey,
      @Param("requestFingerprint") String requestFingerprint);

  int complete(@Param("id") UUID id, @Param("chapterId") UUID chapterId);
}
