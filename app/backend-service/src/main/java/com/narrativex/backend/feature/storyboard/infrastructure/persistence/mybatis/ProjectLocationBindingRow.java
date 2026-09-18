package com.narrativex.backend.feature.storyboard.infrastructure.persistence.mybatis;

import java.util.UUID;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class ProjectLocationBindingRow {
  private UUID projectLocationId;
  private UUID projectId;
  private String name;
  private String description;
  private String visualPrompt;
  private String aiName;
  private String aiAliasesJson;
}
