package com.narrativex.backend.feature.generation.infrastructure.persistence.mybatis;

import java.util.UUID;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class VisualPromptLocationRow {
  private UUID locationId;
  private String name;
  private String description;
  private String visualPrompt;
}
