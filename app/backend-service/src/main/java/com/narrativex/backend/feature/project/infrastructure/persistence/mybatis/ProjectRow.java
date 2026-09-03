package com.narrativex.backend.feature.project.infrastructure.persistence.mybatis;

import com.narrativex.backend.feature.project.domain.aggregate.Project;
import com.narrativex.backend.feature.project.domain.enums.AspectRatio;
import com.narrativex.backend.feature.project.domain.enums.ProjectStatus;
import java.time.Instant;
import java.util.UUID;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** Persistence-only representation of one complete row in {@code projects}. */
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ProjectRow {
  private UUID id;
  private long rowVersion;
  private Instant createdAt;
  private Instant updatedAt;
  private String name;
  private String description;
  private String coverImageUrl;
  private String ownerId;
  private ProjectStatus status;
  private String sourceLanguage;
  private String narrationLanguage;
  private String metadataLanguage;
  private AspectRatio imageAspectRatio;
  private Instant archivedAt;

  public Project toDomain() {
    return Project.rehydrate(
        id,
        rowVersion,
        name,
        description,
        coverImageUrl,
        ownerId,
        status,
        sourceLanguage,
        narrationLanguage,
        metadataLanguage,
        imageAspectRatio,
        archivedAt);
  }
}
