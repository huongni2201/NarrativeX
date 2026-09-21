package com.narrativex.backend.feature.character.infrastructure.persistence.mybatis;

import com.narrativex.backend.feature.common.infrastructure.persistence.mybatis.NarrativeXMyBatisMapper;
import java.util.List;
import java.util.UUID;
import org.apache.ibatis.annotations.Param;

public interface CharacterVoiceProfileMapper extends NarrativeXMyBatisMapper {
  CharacterVoiceProfileRow findById(@Param("id") UUID id);

  CharacterVoiceProfileRow findPinnedByCharacterId(@Param("characterId") UUID characterId);

  List<CharacterVoiceProfileRow> findByCharacterId(@Param("characterId") UUID characterId);

  int maxVoiceProfileVersion(@Param("characterId") UUID characterId);

  UUID insertVoiceProfile(CharacterVoiceProfileRow row);

  int updateVoiceProfile(CharacterVoiceProfileRow row);
}
