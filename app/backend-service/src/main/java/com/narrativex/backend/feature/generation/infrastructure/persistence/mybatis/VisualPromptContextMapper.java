package com.narrativex.backend.feature.generation.infrastructure.persistence.mybatis;

import com.narrativex.backend.feature.common.infrastructure.persistence.mybatis.NarrativeXMyBatisMapper;
import java.util.List;
import org.apache.ibatis.annotations.Param;

public interface VisualPromptContextMapper extends NarrativeXMyBatisMapper {
  VisualPromptLocationRow findLocation(
      @Param("projectId") Long projectId, @Param("sceneId") Long sceneId);

  List<VisualPromptCharacterRow> findCharacters(
      @Param("projectId") Long projectId, @Param("sceneId") Long sceneId);

  List<VisualPromptReferenceRow> findCharacterReferences(
      @Param("projectId") Long projectId, @Param("sceneId") Long sceneId);
}
