package com.narrativex.backend.feature.catalog.infrastructure.persistence.mybatis;

import com.narrativex.backend.feature.common.infrastructure.persistence.mybatis.NarrativeXMyBatisMapper;
import java.util.List;
import org.apache.ibatis.annotations.Param;

public interface CatalogMapper extends NarrativeXMyBatisMapper {
  List<StylePresetRow> listStylePresets(@Param("category") String category);

  List<VoiceRow> listVoices(@Param("language") String language);
}
