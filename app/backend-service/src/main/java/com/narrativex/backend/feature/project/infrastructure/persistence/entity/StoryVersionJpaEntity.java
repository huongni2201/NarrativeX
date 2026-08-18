package com.narrativex.backend.feature.project.infrastructure.persistence.entity;

import com.narrativex.backend.feature.common.infrastructure.persistence.JpaAuditedEntity;
import com.narrativex.backend.feature.project.domain.entity.StoryVersion;
import com.narrativex.backend.feature.project.domain.enums.ModerationDecision;
import com.narrativex.backend.feature.project.domain.enums.StoryVersionStatus;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;

@Entity
@Table(
    name = "story_versions",
    uniqueConstraints =
        @UniqueConstraint(
            name = "uk_story_versions_project_version",
            columnNames = {"project_id", "version_number"}))
public class StoryVersionJpaEntity extends JpaAuditedEntity {
  @Column(name = "project_id", nullable = false)
  private Long projectId;

  @Column(name = "version_number", nullable = false)
  private int versionNumber;

  @Column(name = "content", nullable = false, columnDefinition = "TEXT")
  private String content;

  @Column(name = "source_language", nullable = false, length = 16)
  private String sourceLanguage;

  @Enumerated(EnumType.STRING)
  @Column(name = "status", nullable = false, length = 24)
  private StoryVersionStatus status;

  @Enumerated(EnumType.STRING)
  @Column(name = "moderation_decision", nullable = false, length = 16)
  private ModerationDecision moderationDecision;

  protected StoryVersionJpaEntity() {}

  public StoryVersionJpaEntity(StoryVersion storyVersion) {
    apply(storyVersion);
  }

  public void apply(StoryVersion storyVersion) {
    projectId = storyVersion.getProjectId();
    versionNumber = storyVersion.getVersionNumber();
    content = storyVersion.getContent();
    sourceLanguage = storyVersion.getSourceLanguage();
    status = storyVersion.getStatus();
    moderationDecision = storyVersion.getModerationDecision();
  }

  public Long getProjectId() {
    return projectId;
  }

  public int getVersionNumber() {
    return versionNumber;
  }

  public String getContent() {
    return content;
  }

  public String getSourceLanguage() {
    return sourceLanguage;
  }

  public StoryVersionStatus getStatus() {
    return status;
  }

  public ModerationDecision getModerationDecision() {
    return moderationDecision;
  }
}
