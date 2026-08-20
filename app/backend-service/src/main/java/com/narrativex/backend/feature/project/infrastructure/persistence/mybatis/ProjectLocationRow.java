package com.narrativex.backend.feature.project.infrastructure.persistence.mybatis;

import java.time.Instant;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class ProjectLocationRow {
  private Long id;
  private String name;
  private String description;
  private String visualPrompt;
  private String referenceImageUrl;
  private String status;
  private Instant updatedAt;
}
