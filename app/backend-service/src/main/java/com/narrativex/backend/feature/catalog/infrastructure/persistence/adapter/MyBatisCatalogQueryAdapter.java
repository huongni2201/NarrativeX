package com.narrativex.backend.feature.catalog.infrastructure.persistence.adapter;

import com.narrativex.backend.feature.catalog.application.port.out.CatalogQueryRepository;
import com.narrativex.backend.feature.catalog.application.query.StylePresetView;
import com.narrativex.backend.feature.catalog.application.query.VoiceView;
import com.narrativex.backend.feature.catalog.infrastructure.persistence.mybatis.CatalogMapper;
import com.narrativex.backend.feature.catalog.infrastructure.persistence.mybatis.StylePresetRow;
import com.narrativex.backend.feature.catalog.infrastructure.persistence.mybatis.VoiceRow;
import java.util.Collections;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.ObjectMapper;

@Component
@RequiredArgsConstructor
public class MyBatisCatalogQueryAdapter implements CatalogQueryRepository {
  private static final TypeReference<List<String>> TAGS_TYPE = new TypeReference<>() {};

  private final CatalogMapper mapper;
  private final ObjectMapper objectMapper;

  @Override
  public List<StylePresetView> listStylePresets(String category) {
    return mapper.listStylePresets(category).stream().map(this::toStylePreset).toList();
  }

  @Override
  public List<VoiceView> listVoices(String language) {
    return mapper.listVoices(language).stream().map(this::toVoice).toList();
  }

  private StylePresetView toStylePreset(StylePresetRow row) {
    return new StylePresetView(
        row.getId(), row.getName(), row.getCategory(), row.getDescription(), row.getThumbnailUrl(),
        row.getPromptSuffix(), row.getNegativePrompt(), parseTags(row.getTagsJson()),
        row.getConfigJson(), row.getCreatedAt());
  }

  private VoiceView toVoice(VoiceRow row) {
    return new VoiceView(
        row.getId(), row.getProvider(), row.getName(), row.getLanguage(), row.getGender(),
        row.getSampleUrl(), row.getMetadataJson(), row.getUpdatedAt());
  }

  private List<String> parseTags(String value) {
    try {
      return objectMapper.readValue(value, TAGS_TYPE);
    } catch (Exception ignored) {
      return Collections.emptyList();
    }
  }
}
