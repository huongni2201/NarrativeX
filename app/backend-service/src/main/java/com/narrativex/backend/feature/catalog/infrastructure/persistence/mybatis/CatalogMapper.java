package com.narrativex.backend.feature.catalog.infrastructure.persistence.mybatis;

import com.narrativex.backend.feature.common.infrastructure.persistence.mybatis.NarrativeXMyBatisMapper;
import java.util.List;
import java.util.Optional;
import org.apache.ibatis.annotations.Param;

public interface CatalogMapper extends NarrativeXMyBatisMapper {
  List<StylePresetRow> listStylePresets(@Param("category") String category);

  List<VoiceRow> listVoices(@Param("language") String language);

  Optional<VoiceCapabilitiesRow> findVoiceCapabilities(@Param("voiceId") String voiceId);

  int insertCustomVoice(
      @Param("id") String id,
      @Param("name") String name,
      @Param("language") String language,
      @Param("gender") String gender,
      @Param("metadataJson") String metadataJson);

  int disableCustomVoice(@Param("id") String id);
}
