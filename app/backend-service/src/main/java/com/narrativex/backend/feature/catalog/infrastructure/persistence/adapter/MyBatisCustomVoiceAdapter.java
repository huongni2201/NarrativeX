package com.narrativex.backend.feature.catalog.infrastructure.persistence.adapter;

import com.narrativex.backend.feature.catalog.application.port.out.CustomVoiceRepository;
import com.narrativex.backend.feature.catalog.infrastructure.persistence.mybatis.CatalogMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class MyBatisCustomVoiceAdapter implements CustomVoiceRepository {
  private final CatalogMapper mapper;

  @Override
  public boolean insert(
      String id, String name, String language, String gender, String metadataJson) {
    return mapper.insertCustomVoice(id, name, language, gender, metadataJson) == 1;
  }

  @Override
  public boolean disable(String id) {
    return mapper.disableCustomVoice(id) == 1;
  }
}
