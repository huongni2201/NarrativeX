package com.narrativex.backend.feature.character.infrastructure.persistence.mybatis;

import com.narrativex.backend.feature.common.infrastructure.persistence.mybatis.NarrativeXMyBatisMapper;
import java.time.Instant;
import java.util.List;
import org.apache.ibatis.annotations.Param;

public interface CharacterMapper extends NarrativeXMyBatisMapper {
  List<CharacterRow> findActiveFirstPage(@Param("ownerId") String ownerId, @Param("limit") int limit);
  List<CharacterRow> findActiveAfter(@Param("ownerId") String ownerId, @Param("updatedAt") Instant updatedAt, @Param("id") Long id, @Param("limit") int limit);
  long countActive(@Param("ownerId") String ownerId, @Param("status") String status);
  CharacterRow findOwned(@Param("id") Long id, @Param("ownerId") String ownerId, @Param("excludedStatus") String excludedStatus);
  CharacterRow findOwnedForUpdate(@Param("id") Long id, @Param("ownerId") String ownerId, @Param("excludedStatus") String excludedStatus);
  CharacterRow findCharacter(@Param("id") Long id);
  Long insertCharacter(CharacterRow row);
  int updateCharacter(CharacterRow row);

  int maxCharacterVersion(@Param("characterId") Long characterId);
  CharacterVersionRow findOwnedVersion(@Param("id") Long id, @Param("ownerId") String ownerId);
  CharacterVersionRow findCharacterVersion(@Param("id") Long id);
  Long insertCharacterVersion(CharacterVersionRow row);
  int updateCharacterVersion(CharacterVersionRow row);

  int maxOutfitVersion(@Param("characterId") Long characterId);
  OutfitVersionRow findOwnedOutfit(@Param("id") Long id, @Param("ownerId") String ownerId, @Param("excludedStatus") String excludedStatus);
  OutfitVersionRow findOutfit(@Param("id") Long id);
  Long insertOutfit(OutfitVersionRow row);
  int updateOutfit(OutfitVersionRow row);

  CharacterAppearanceRow findAppearance(@Param("id") Long id);
  Long insertAppearance(CharacterAppearanceRow row);
  int updateAppearance(CharacterAppearanceRow row);

  ProjectCharacterRow findProjectCharacter(@Param("id") Long id);
  Long insertProjectCharacter(ProjectCharacterRow row);
  int updateProjectCharacter(ProjectCharacterRow row);
}
