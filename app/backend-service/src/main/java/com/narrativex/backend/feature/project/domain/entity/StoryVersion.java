package com.narrativex.backend.feature.project.domain.entity;

import com.narrativex.backend.feature.common.domain.UuidDomainEntity;
import com.narrativex.backend.feature.project.domain.enums.StoryVersionStatus;
import com.narrativex.backend.feature.project.domain.exception.InvalidStoryVersionTransitionException;
import java.util.Objects;
import java.util.UUID;

/** Story version entity owned by the Project aggregate. */
public final class StoryVersion extends UuidDomainEntity {
  private final UUID projectId;
  private final int versionNumber;
  private final String content;
  private final String sourceLanguage;
  private StoryVersionStatus status;

  private StoryVersion(
      UUID id,
      long rowVersion,
      UUID projectId,
      int versionNumber,
      String content,
      String sourceLanguage,
      StoryVersionStatus status) {
    super(id, rowVersion);
    this.projectId = Objects.requireNonNull(projectId, "projectId");
    if (versionNumber <= 0) throw new IllegalArgumentException("versionNumber must be positive");
    if (content == null || content.isBlank())
      throw new IllegalArgumentException("content must not be blank");
    this.versionNumber = versionNumber;
    this.content = content;
    this.sourceLanguage = Objects.requireNonNull(sourceLanguage, "sourceLanguage");
    this.status = Objects.requireNonNull(status, "status");
  }

  public static StoryVersion create(
      UUID projectId, int versionNumber, String content, String sourceLanguage) {
    return new StoryVersion(
        null, 0L, projectId, versionNumber, content, sourceLanguage, StoryVersionStatus.DRAFT);
  }

  public static StoryVersion rehydrate(
      UUID id,
      long rowVersion,
      UUID projectId,
      int versionNumber,
      String content,
      String sourceLanguage,
      StoryVersionStatus status) {
    return new StoryVersion(
        id, rowVersion, projectId, versionNumber, content, sourceLanguage, status);
  }

  public void activate() {
    if (status != StoryVersionStatus.DRAFT) {
      throw new InvalidStoryVersionTransitionException(
          "Only draft story versions can be activated");
    }
    status = StoryVersionStatus.ACTIVE;
  }

  public void supersede() {
    if (status != StoryVersionStatus.ACTIVE) {
      throw new InvalidStoryVersionTransitionException(
          "Only active story versions can be superseded");
    }
    status = StoryVersionStatus.SUPERSEDED;
  }

  public UUID getProjectId() {
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
}
