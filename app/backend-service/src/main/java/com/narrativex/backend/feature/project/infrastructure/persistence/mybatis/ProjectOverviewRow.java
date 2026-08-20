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
public class ProjectOverviewRow {
  private Long id;
  private String name;
  private String description;
  private String coverImageUrl;
  private String status;
  private Instant createdAt;
  private Instant updatedAt;
  private Long storyVersionId;
  private int approvedVisualsCount;
  private int processingJobsCount;
  private int charactersCount;
  private int locationsCount;
  private int assetsCount;
}
