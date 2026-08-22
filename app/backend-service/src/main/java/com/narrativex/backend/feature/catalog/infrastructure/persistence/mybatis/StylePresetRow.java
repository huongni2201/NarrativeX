package com.narrativex.backend.feature.catalog.infrastructure.persistence.mybatis;

import java.time.Instant;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class StylePresetRow {
  private Long id;
  private String name;
  private String category;
  private String description;
  private String thumbnailUrl;
  private String promptSuffix;
  private String negativePrompt;
  private String tagsJson;
  private String configJson;
  private Instant createdAt;
}
