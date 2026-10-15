package com.narrativex.backend.feature.generation.infrastructure.persistence.adapter;

import com.narrativex.backend.feature.generation.application.model.prompt.PromptSettings;
import com.narrativex.backend.feature.generation.application.model.prompt.PromptSettingsJson;
import com.narrativex.backend.feature.generation.application.port.out.PromptSettingsRepository;
import com.narrativex.backend.feature.generation.infrastructure.persistence.mybatis.PromptSettingsMapper;
import com.narrativex.backend.feature.generation.infrastructure.persistence.mybatis.PromptSettingsRow;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import tools.jackson.databind.ObjectMapper;

@Component
@RequiredArgsConstructor
public class MyBatisPromptSettingsRepository implements PromptSettingsRepository {
  private final PromptSettingsMapper mapper;
  private final ObjectMapper objectMapper;

  @Override
  public Optional<PromptSettings> find() {
    return Optional.ofNullable(mapper.find()).map(this::toSettings);
  }

  @Override
  public PromptSettings insertIfAbsent(PromptSettings initial) {
    PromptSettings stored = initial.withRevision(0);
    mapper.insertIfAbsent(
        stored.formatVersion(),
        PromptSettingsJson.toJsonString(objectMapper, stored),
        stored.semanticHash());
    return find()
        .orElseThrow(() -> new IllegalStateException("Prompt settings could not be initialized"));
  }

  @Override
  public Optional<PromptSettings> update(PromptSettings desired, long expectedRevision) {
    PromptSettings stored = desired.withRevision(0);
    int updated =
        mapper.update(
            stored.formatVersion(),
            PromptSettingsJson.toJsonString(objectMapper, stored),
            stored.semanticHash(),
            expectedRevision);
    return updated == 0 ? Optional.empty() : find();
  }

  private PromptSettings toSettings(PromptSettingsRow row) {
    return PromptSettingsJson.parse(objectMapper, row.getSettingsJson())
        .withRevision(row.getRevision());
  }
}
