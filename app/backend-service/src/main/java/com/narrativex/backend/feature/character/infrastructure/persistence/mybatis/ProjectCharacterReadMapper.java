package com.narrativex.backend.feature.character.infrastructure.persistence.mybatis;

import com.narrativex.backend.feature.common.infrastructure.persistence.mybatis.NarrativeXMyBatisMapper;
import java.time.Instant;
import java.util.List;
import org.apache.ibatis.annotations.Param;

public interface ProjectCharacterReadMapper extends NarrativeXMyBatisMapper {
  boolean projectOwnedBy(@Param("projectId") Long projectId, @Param("ownerId") String ownerId);

  List<ProjectCharacterReadRow> findFirstPage(
      @Param("projectId") Long projectId,
      @Param("ownerId") String ownerId,
      @Param("limit") int limit);

  List<ProjectCharacterReadRow> findAfter(
      @Param("projectId") Long projectId,
      @Param("ownerId") String ownerId,
      @Param("updatedAt") Instant updatedAt,
      @Param("id") Long id,
      @Param("limit") int limit);

  ProjectCharacterReadRow findDetail(
      @Param("projectId") Long projectId,
      @Param("characterId") Long characterId,
      @Param("ownerId") String ownerId);
}
