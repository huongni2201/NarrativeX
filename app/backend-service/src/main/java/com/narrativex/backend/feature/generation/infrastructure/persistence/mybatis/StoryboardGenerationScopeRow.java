package com.narrativex.backend.feature.generation.infrastructure.persistence.mybatis;

import java.util.UUID;
import lombok.Data;

@Data
public class StoryboardGenerationScopeRow {
  private UUID storyboardRevisionId;
  private String sourceHash;
}
