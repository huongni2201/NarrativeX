package com.narrativex.backend.feature.storyboard.infrastructure.persistence.mybatis;

import com.narrativex.backend.feature.common.infrastructure.persistence.mybatis.NarrativeXMyBatisMapper;
import java.util.UUID;
import org.apache.ibatis.annotations.Param;

public interface LanguageDetectionMapper extends NarrativeXMyBatisMapper {
  Long insert(LanguageDetectionRow row);

  LanguageDetectionRow findLatest(
      @Param("contentVariantId") UUID contentVariantId, @Param("contentHash") String contentHash);
}
