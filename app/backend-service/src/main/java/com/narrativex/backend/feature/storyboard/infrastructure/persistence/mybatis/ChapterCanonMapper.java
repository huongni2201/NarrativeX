package com.narrativex.backend.feature.storyboard.infrastructure.persistence.mybatis;

import com.narrativex.backend.feature.character.infrastructure.persistence.mybatis.CharacterRow;
import com.narrativex.backend.feature.character.infrastructure.persistence.mybatis.CharacterVersionRow;
import com.narrativex.backend.feature.character.infrastructure.persistence.mybatis.ProjectCharacterRow;
import com.narrativex.backend.feature.common.infrastructure.persistence.mybatis.NarrativeXMyBatisMapper;
import java.util.List;
import java.util.UUID;
import org.apache.ibatis.annotations.Param;

public interface ChapterCanonMapper extends NarrativeXMyBatisMapper {

  List<ProjectCharacterBindingRow> findProjectCharacterBindings(@Param("projectId") UUID projectId);

  List<ProjectLocationBindingRow> findProjectLocationBindings(@Param("projectId") UUID projectId);

  UUID insertCharacter(CharacterRow row);

  UUID insertCharacterVersion(CharacterVersionRow row);

  int maxCharacterVersion(@Param("characterId") UUID characterId);

  UUID insertProjectCharacter(ProjectCharacterRow row);

  void upsertProjectCharacterAiIdentity(
      @Param("projectId") UUID projectId,
      @Param("projectCharacterId") UUID projectCharacterId,
      @Param("aiName") String aiName,
      @Param("aliasesJson") String aliasesJson);

  UUID insertProjectLocation(ProjectLocationRow row);

  void upsertProjectLocationAiIdentity(
      @Param("projectId") UUID projectId,
      @Param("projectLocationId") UUID projectLocationId,
      @Param("aiName") String aiName,
      @Param("aliasesJson") String aliasesJson);

  void insertSceneCharacter(
      @Param("sceneId") UUID sceneId,
      @Param("orderIndex") int orderIndex,
      @Param("projectCharacterId") UUID projectCharacterId);

  void insertVisualBeatCharacter(
      @Param("visualBeatId") UUID visualBeatId,
      @Param("projectCharacterId") UUID projectCharacterId,
      @Param("role") String role);

  List<SceneCharacterRow> findSceneCharacters(@Param("sceneId") UUID sceneId);

  List<VisualBeatCharacterRow> findVisualBeatCharacters(@Param("visualBeatId") UUID visualBeatId);

  List<ProjectLocationRow> findProjectLocations(@Param("projectId") UUID projectId);
}
