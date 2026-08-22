package com.narrativex.backend.feature.project.domain.entity;

import com.narrativex.backend.feature.common.domain.DomainEntity;
import com.narrativex.backend.feature.project.domain.enums.ModerationDecision;
import com.narrativex.backend.feature.project.domain.enums.StoryVersionStatus;
import com.narrativex.backend.feature.project.domain.exception.InvalidStoryVersionTransitionException;
import java.util.Objects;

/** Story version entity owned by the Project aggregate. */
public final class StoryVersion extends DomainEntity {
  private final Long projectId;
  private final int versionNumber;
  private final String content;
  private final String sourceLanguage;
  private StoryVersionStatus status;
  private final ModerationDecision moderationDecision;

  private StoryVersion(
      Long id,
      long rowVersion,
      Long projectId,
      int versionNumber,
      String content,
      String sourceLanguage,
      StoryVersionStatus status,
      ModerationDecision moderationDecision) {
    super(id, rowVersion);
    if (projectId == null || projectId <= 0)
      throw new IllegalArgumentException("projectId must be positive");
    if (versionNumber <= 0) throw new IllegalArgumentException("versionNumber must be positive");
    if (content == null || content.isBlank())
      throw new IllegalArgumentException("content must not be blank");
    this.projectId = projectId;
    this.versionNumber = versionNumber;
    this.content = content;
    this.sourceLanguage = Objects.requireNonNull(sourceLanguage, "sourceLanguage");
    this.status = Objects.requireNonNull(status, "status");
    this.moderationDecision = Objects.requireNonNull(moderationDecision, "moderationDecision");
  }

  public static StoryVersion create(
      Long projectId, int versionNumber, String content, String sourceLanguage) {
    return new StoryVersion(
        null,
        0L,
        projectId,
        versionNumber,
        content,
        sourceLanguage,
        StoryVersionStatus.DRAFT,
        ModerationDecision.NOT_REQUIRED);
  }

  public static StoryVersion rehydrate(
      Long id,
      long rowVersion,
      Long projectId,
      int versionNumber,
      String content,
      String sourceLanguage,
      StoryVersionStatus status,
      ModerationDecision moderationDecision) {
    return new StoryVersion(
        id,
        rowVersion,
        projectId,
        versionNumber,
        content,
        sourceLanguage,
        status,
        moderationDecision);
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
