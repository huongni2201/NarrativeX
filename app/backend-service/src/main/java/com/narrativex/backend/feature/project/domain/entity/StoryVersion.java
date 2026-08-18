package com.narrativex.backend.feature.project.domain.entity;

import com.narrativex.backend.feature.common.domain.DomainEntity;
import com.narrativex.backend.feature.project.domain.enums.ModerationDecision;
import com.narrativex.backend.feature.project.domain.enums.StoryVersionStatus;
import com.narrativex.backend.feature.project.domain.exception.InvalidStoryVersionTransitionException;
import java.time.Instant;
import java.util.Objects;

/** Story version entity owned by the Project aggregate. */
public final class StoryVersion extends DomainEntity {
  private static final String LEGACY_RIGHTS_POLICY_NOT_REQUIRED = "not-required";
  private static final String LEGACY_RIGHTS_BASIS_NOT_REQUIRED = "NOT_REQUIRED";

  private final Long projectId;
  private final int versionNumber;
  private final String content;
  private final String sourceLanguage;
  private StoryVersionStatus status;
  private final ModerationDecision moderationDecision;
  private final boolean rightsAttested;
  private final String rightsPolicyVersion;
  private final String rightsBasis;
  private final Instant rightsAttestedAt;
  private final String rightsAttestedBy;

  private StoryVersion(
      Long id,
      long rowVersion,
      Long projectId,
      int versionNumber,
      String content,
      String sourceLanguage,
      StoryVersionStatus status,
      ModerationDecision moderationDecision,
      boolean rightsAttested,
      String rightsPolicyVersion,
      String rightsBasis,
      Instant rightsAttestedAt,
      String rightsAttestedBy) {
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
    this.rightsAttested = rightsAttested;
    this.rightsPolicyVersion = Objects.requireNonNull(rightsPolicyVersion, "rightsPolicyVersion");
    this.rightsBasis = Objects.requireNonNull(rightsBasis, "rightsBasis");
    this.rightsAttestedAt = rightsAttestedAt;
    this.rightsAttestedBy = rightsAttestedBy;
    if (rightsAttested
        && (rightsAttestedAt == null || rightsAttestedBy == null || rightsAttestedBy.isBlank())) {
      throw new IllegalArgumentException("Attested rights require timestamp and actor");
    }
  }

  public static StoryVersion create(
      Long projectId,
      int versionNumber,
      String content,
      String sourceLanguage) {
    return new StoryVersion(
        null,
        0L,
        projectId,
        versionNumber,
        content,
        sourceLanguage,
        StoryVersionStatus.DRAFT,
        ModerationDecision.PENDING,
        false,
        LEGACY_RIGHTS_POLICY_NOT_REQUIRED,
        LEGACY_RIGHTS_BASIS_NOT_REQUIRED,
        null,
        null);
  }

  public static StoryVersion rehydrate(
      Long id,
      long rowVersion,
      Long projectId,
      int versionNumber,
      String content,
      String sourceLanguage,
      StoryVersionStatus status,
      ModerationDecision moderationDecision,
      boolean rightsAttested,
      String rightsPolicyVersion,
      String rightsBasis,
      Instant rightsAttestedAt,
      String rightsAttestedBy) {
    return new StoryVersion(
        id,
        rowVersion,
        projectId,
        versionNumber,
        content,
        sourceLanguage,
        status,
        moderationDecision,
        rightsAttested,
        rightsPolicyVersion,
        rightsBasis,
        rightsAttestedAt,
        rightsAttestedBy);
  }

  /**
   * Transitions this version to ACTIVE. Application code should coordinate this transition through
   * the owning {@code Project} so the previous ACTIVE version is superseded in the same transaction.
   */
  public void activate() {
    if (status != StoryVersionStatus.DRAFT) {
      throw new InvalidStoryVersionTransitionException(
          "Only draft story versions can be activated");
    }
    status = StoryVersionStatus.ACTIVE;
  }

  /** Supersedes the currently ACTIVE version as part of a Project-owned activation transition. */
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

  public boolean isRightsAttested() {
    return rightsAttested;
  }

  public String getRightsPolicyVersion() {
    return rightsPolicyVersion;
  }

  public String getRightsBasis() {
    return rightsBasis;
  }

  public Instant getRightsAttestedAt() {
    return rightsAttestedAt;
  }

  public String getRightsAttestedBy() {
    return rightsAttestedBy;
  }
}
