package com.narrativex.backend.feature.character.infrastructure.persistence.mybatis;

import com.narrativex.backend.feature.common.infrastructure.persistence.mybatis.NarrativeXMyBatisMapper;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.apache.ibatis.annotations.Param;

public interface ProjectCharacterReadMapper extends NarrativeXMyBatisMapper {
  boolean projectExists(@Param("projectId") UUID projectId);

  List<ProjectCharacterReadRow> findFirstPage(
      @Param("projectId") UUID projectId,
      @Param("limit") int limit);

  List<ProjectCharacterReadRow> findAfter(
      @Param("projectId") UUID projectId,
      @Param("updatedAt") Instant updatedAt,
      @Param("id") UUID id,
      @Param("limit") int limit);

  ProjectCharacterReadRow findDetail(
      @Param("projectId") UUID projectId,
      @Param("characterId") UUID characterId);
}
