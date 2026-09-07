package com.narrativex.backend.feature.generation.infrastructure.persistence.mybatis;

import com.narrativex.backend.feature.common.infrastructure.persistence.mybatis.NarrativeXMyBatisMapper;
import java.util.List;
import java.util.UUID;
import org.apache.ibatis.annotations.Param;

public interface VisualPromptContextMapper extends NarrativeXMyBatisMapper {
  VisualPromptLocationRow findLocation(
      @Param("projectId") UUID projectId, @Param("sceneId") UUID sceneId);

  List<VisualPromptCharacterRow> findCharacters(
      @Param("projectId") UUID projectId, @Param("sceneId") UUID sceneId);

  List<VisualPromptReferenceRow> findCharacterReferences(
      @Param("projectId") UUID projectId, @Param("sceneId") UUID sceneId);

  VisualPromptLocationRow findLocationForBeat(
      @Param("projectId") UUID projectId, @Param("visualBeatId") UUID visualBeatId);

  List<VisualPromptCharacterRow> findCharactersForBeat(
      @Param("projectId") UUID projectId, @Param("visualBeatId") UUID visualBeatId);

  List<VisualPromptReferenceRow> findCharacterReferencesForBeat(
      @Param("projectId") UUID projectId, @Param("visualBeatId") UUID visualBeatId);

  List<VisualPromptLocationRow> findLocationsForBeats(
      @Param("projectId") UUID projectId, @Param("visualBeatIds") List<UUID> visualBeatIds);

  List<VisualPromptCharacterRow> findCharactersForBeats(
      @Param("projectId") UUID projectId, @Param("visualBeatIds") List<UUID> visualBeatIds);

  List<VisualPromptReferenceRow> findCharacterReferencesForBeats(
      @Param("projectId") UUID projectId, @Param("visualBeatIds") List<UUID> visualBeatIds);
}
