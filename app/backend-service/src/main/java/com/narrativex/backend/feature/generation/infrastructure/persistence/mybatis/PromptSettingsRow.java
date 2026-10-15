package com.narrativex.backend.feature.generation.infrastructure.persistence.mybatis;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class PromptSettingsRow {
  private long revision;
  private String settingsJson;
}
