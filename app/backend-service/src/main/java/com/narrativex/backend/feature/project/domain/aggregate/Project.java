package com.narrativex.backend.feature.project.domain.aggregate;

import com.narrativex.backend.feature.common.domain.AggregateRoot;
import com.narrativex.backend.feature.project.domain.entity.StoryVersion;
import com.narrativex.backend.feature.project.domain.enums.AspectRatio;
import com.narrativex.backend.feature.project.domain.enums.ImageQualityTier;
import com.narrativex.backend.feature.project.domain.enums.ProjectStatus;
import com.narrativex.backend.feature.project.domain.enums.StoryVersionStatus;
import com.narrativex.backend.feature.project.domain.exception.ArchivedProjectException;
import com.narrativex.backend.feature.project.domain.exception.ProjectPersistenceRequiredException;
import java.time.Instant;
import java.util.Objects;

/** Project aggregate root; child story versions are created and activated through this boundary. */
public final class Project extends AggregateRoot {
  private final String name;
  private final String description;
  private final String coverImageUrl;
  private final String ownerId;
  private ProjectStatus status;
  private final String sourceLanguage;
  private final String narrationLanguage;
  private final String metadataLanguage;
  private final AspectRatio imageAspectRatio;
  private final ImageQualityTier imageQualityTier;
  private Instant archivedAt;

  private Project(
      Long id,
      long rowVersion,
      String name,
      String description,
      String coverImageUrl,
      String ownerId,
      ProjectStatus status,
      String sourceLanguage,
      String narrationLanguage,
      String metadataLanguage,
      AspectRatio imageAspectRatio,
      ImageQualityTier imageQualityTier,
      Instant archivedAt) {
    super(id, rowVersion);
    this.name = required(name, "name", 160);
    this.description = description;
    this.coverImageUrl = coverImageUrl;
    this.ownerId = required(ownerId, "ownerId", 128);
    this.status = Objects.requireNonNull(status, "status");
    this.sourceLanguage = required(sourceLanguage, "sourceLanguage", 16);
    this.narrationLanguage = required(narrationLanguage, "narrationLanguage", 16);
    this.metadataLanguage = required(metadataLanguage, "metadataLanguage", 16);
    this.imageAspectRatio = Objects.requireNonNull(imageAspectRatio, "imageAspectRatio");
    this.imageQualityTier = Objects.requireNonNull(imageQualityTier, "imageQualityTier");
    this.archivedAt = archivedAt;
  }

  public static Project create(
      String name,
      String ownerId,
      String sourceLanguage,
      String narrationLanguage,
      String metadataLanguage,
      AspectRatio imageAspectRatio,
      ImageQualityTier imageQualityTier) {
    return new Project(
        null,
        0L,
        name,
        null,
        null,
        ownerId,
        ProjectStatus.DRAFT,
        sourceLanguage,
        narrationLanguage,
        metadataLanguage,
        imageAspectRatio,
        imageQualityTier,
        null);
  }

  public static Project rehydrate(
      Long id,
      long rowVersion,
      String name,
      String ownerId,
      ProjectStatus status,
      String sourceLanguage,
      String narrationLanguage,
      String metadataLanguage,
      AspectRatio imageAspectRatio,
      ImageQualityTier imageQualityTier,
      Instant archivedAt) {
    return new Project(
        id,
        rowVersion,
        name,
        null,
        null,
        ownerId,
        status,
        sourceLanguage,
        narrationLanguage,
        metadataLanguage,
        imageAspectRatio,
        imageQualityTier,
        archivedAt);
  }

  public static Project rehydrate(
      Long id,
      long rowVersion,
      String name,
      String description,
      String coverImageUrl,
      String ownerId,
      ProjectStatus status,
      String sourceLanguage,
      String narrationLanguage,
      String metadataLanguage,
      AspectRatio imageAspectRatio,
      ImageQualityTier imageQualityTier,
      Instant archivedAt) {
    return new Project(
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
        imageQualityTier,
        archivedAt);
  }

  public StoryVersion createStoryVersion(int versionNumber, String content, String sourceLanguage) {
    ensureStoryVersionCanBeManaged();
    return StoryVersion.create(getId(), versionNumber, content, sourceLanguage);
  }

  /**
   * Owns the StoryVersion activation lifecycle. The application transaction must lock this Project,
   * load the current ACTIVE version, persist its SUPERSEDED transition, and only then persist the
   * new ACTIVE version.
   */
  public void activateStoryVersion(StoryVersion nextVersion, StoryVersion currentActiveVersion) {
    ensureStoryVersionCanBeManaged();
    StoryVersion next = requireOwnedStoryVersion(nextVersion, "nextVersion");
    if (currentActiveVersion != null) {
      StoryVersion current = requireOwnedStoryVersion(currentActiveVersion, "currentActiveVersion");
      if (Objects.equals(current.getId(), next.getId()) && current.getId() != null) {
        throw new IllegalArgumentException("Current and next story version must be different");
      }
      current.supersede();
    }
    next.activate();
    ensureProjectActive();
  }

  /** Repairs a DRAFT project when its persisted StoryVersion is already ACTIVE. */
  public void reconcileActiveStoryVersion(StoryVersion activeVersion) {
    ensureStoryVersionCanBeManaged();
    StoryVersion active = requireOwnedStoryVersion(activeVersion, "activeVersion");
    if (active.getStatus() != StoryVersionStatus.ACTIVE) {
      throw new IllegalArgumentException("activeVersion must be active");
    }
    ensureProjectActive();
  }

  public void archive() {
    if (status == ProjectStatus.ARCHIVED) {
      return;
    }
    status = ProjectStatus.ARCHIVED;
    archivedAt = Instant.now();
  }

  private StoryVersion requireOwnedStoryVersion(StoryVersion storyVersion, String field) {
    StoryVersion resolved = Objects.requireNonNull(storyVersion, field);
    if (!Objects.equals(getId(), resolved.getProjectId())) {
      throw new IllegalArgumentException(field + " does not belong to this project");
    }
    return resolved;
  }

  private void ensureStoryVersionCanBeManaged() {
    if (status == ProjectStatus.ARCHIVED) {
      throw new ArchivedProjectException();
    }
    if (getId() == null) {
      throw new ProjectPersistenceRequiredException();
    }
  }

  private void ensureProjectActive() {
    if (status == ProjectStatus.DRAFT) {
      status = ProjectStatus.ACTIVE;
    }
  }

  public String getName() {
    return name;
  }

  public String getDescription() {
    return description;
  }

  public String getCoverImageUrl() {
    return coverImageUrl;
  }

  public String getOwnerId() {
    return ownerId;
  }

  public ProjectStatus getStatus() {
    return status;
  }

  public String getSourceLanguage() {
    return sourceLanguage;
  }

  public String getNarrationLanguage() {
    return narrationLanguage;
  }

  public String getMetadataLanguage() {
    return metadataLanguage;
  }

  public AspectRatio getImageAspectRatio() {
    return imageAspectRatio;
  }

  public ImageQualityTier getImageQualityTier() {
    return imageQualityTier;
  }

  public Instant getArchivedAt() {
    return archivedAt;
  }

  private static String required(String value, String field, int maxLength) {
    if (value == null || value.isBlank()) {
      throw new IllegalArgumentException(field + " must not be blank");
    }
    if (value.length() > maxLength) {
      throw new IllegalArgumentException(field + " exceeds the maximum length");
    }
    return value;
  }
}
