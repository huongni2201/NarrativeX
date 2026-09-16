package com.narrativex.backend.feature.character.infrastructure.persistence.mybatis;

import com.narrativex.backend.feature.common.infrastructure.persistence.mybatis.NarrativeXMyBatisMapper;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.apache.ibatis.annotations.Param;

public interface CharacterMapper extends NarrativeXMyBatisMapper {
  List<CharacterRow> findActiveFirstPage(@Param("limit") int limit);

  List<CharacterRow> findActiveAfter(
      @Param("updatedAt") Instant updatedAt, @Param("id") UUID id, @Param("limit") int limit);

  long countActive(@Param("status") String status);

  CharacterRow findActiveById(@Param("id") UUID id, @Param("excludedStatus") String excludedStatus);

  CharacterRow findActiveByIdForUpdate(
      @Param("id") UUID id, @Param("excludedStatus") String excludedStatus);

  CharacterRow findCharacter(@Param("id") UUID id);

  UUID insertCharacter(CharacterRow row);

  int updateCharacter(CharacterRow row);

  int maxCharacterVersion(@Param("characterId") UUID characterId);

  CharacterVersionRow findVersion(@Param("id") UUID id);

  CharacterVersionRow findVersionForUpdate(@Param("id") UUID id);

  CharacterVersionRow findCharacterVersion(@Param("id") UUID id);

  UUID insertCharacterVersion(CharacterVersionRow row);

  int updateCharacterVersion(CharacterVersionRow row);

  int maxOutfitVersion(@Param("characterId") UUID characterId);

  OutfitVersionRow findActiveOutfit(
      @Param("id") UUID id, @Param("excludedStatus") String excludedStatus);

  OutfitVersionRow findOutfit(@Param("id") UUID id);

  UUID insertOutfit(OutfitVersionRow row);

  int updateOutfit(OutfitVersionRow row);

  CharacterAppearanceRow findAppearance(@Param("id") UUID id);

  UUID insertAppearance(CharacterAppearanceRow row);

  int updateAppearance(CharacterAppearanceRow row);

  ProjectCharacterRow findProjectCharacter(@Param("id") UUID id);

  ProjectCharacterRow findProjectCharacterByProjectAndCharacterForUpdate(
      @Param("projectId") UUID projectId, @Param("characterId") UUID characterId);

  UUID insertProjectCharacter(ProjectCharacterRow row);

  int updateProjectCharacter(ProjectCharacterRow row);
}
