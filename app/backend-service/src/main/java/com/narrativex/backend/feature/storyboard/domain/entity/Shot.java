package com.narrativex.backend.feature.storyboard.domain.entity;

import com.narrativex.backend.feature.common.domain.DomainEntity;
import com.narrativex.backend.feature.common.domain.enums.GenerationStrategy;
import com.narrativex.backend.feature.storyboard.domain.enums.RetentionRole;
import com.narrativex.backend.feature.storyboard.domain.enums.ShotStatus;
import java.util.Objects;
import java.util.UUID;
import lombok.Getter;

/** The definitive atomic production unit for video generation, leasing, QA, and editing. */
public final class Shot extends DomainEntity {
  @Getter private final UUID sequenceId;
  @Getter private final int orderIndex;
  @Getter private final String narrativePurpose;
  @Getter private final RetentionRole retentionRole;
  @Getter private final String subjectsJson;
  @Getter private final String locationRef;
  @Getter private final String startStateJson;
  @Getter private final String actionJson;
  @Getter private final String endStateJson;
  @Getter private final String compositionJson;
  @Getter private final String cameraJson;
  @Getter private final String subjectMotionJson;
  @Getter private final String cameraMotionJson;
  @Getter private final String environmentMotionJson;
  @Getter private final long targetDurationMs;
  @Getter private final GenerationStrategy generationStrategy;
  @Getter private final String qualityProfile;
  @Getter private final UUID continuityFromShotId;
  @Getter private final UUID continuityToShotId;
  @Getter private final ShotStatus status;

  public Shot(
      UUID sequenceId,
      int orderIndex,
      String narrativePurpose,
      RetentionRole retentionRole,
      String subjectsJson,
      String locationRef,
      String startStateJson,
      String actionJson,
      String endStateJson,
      String compositionJson,
      String cameraJson,
      String subjectMotionJson,
      String cameraMotionJson,
      String environmentMotionJson,
      long targetDurationMs,
      GenerationStrategy generationStrategy,
      String qualityProfile,
      UUID continuityFromShotId,
      UUID continuityToShotId,
      ShotStatus status) {
    this(
        null,
        0L,
        sequenceId,
        orderIndex,
        narrativePurpose,
        retentionRole,
        subjectsJson,
        locationRef,
        startStateJson,
        actionJson,
        endStateJson,
        compositionJson,
        cameraJson,
        subjectMotionJson,
        cameraMotionJson,
        environmentMotionJson,
        targetDurationMs,
        generationStrategy,
        qualityProfile,
        continuityFromShotId,
        continuityToShotId,
        status);
  }

  public Shot(
      UUID id,
      long rowVersion,
      UUID sequenceId,
      int orderIndex,
      String narrativePurpose,
      RetentionRole retentionRole,
      String subjectsJson,
      String locationRef,
      String startStateJson,
      String actionJson,
      String endStateJson,
      String compositionJson,
      String cameraJson,
      String subjectMotionJson,
      String cameraMotionJson,
      String environmentMotionJson,
      long targetDurationMs,
      GenerationStrategy generationStrategy,
      String qualityProfile,
      UUID continuityFromShotId,
      UUID continuityToShotId,
      ShotStatus status) {
    super(id, rowVersion);
    this.sequenceId = Objects.requireNonNull(sequenceId, "sequenceId must not be null");
    if (orderIndex < 0) {
      throw new IllegalArgumentException("orderIndex must not be negative");
    }
    this.orderIndex = orderIndex;
    this.narrativePurpose = narrativePurpose != null ? narrativePurpose.trim() : "";
    this.retentionRole = retentionRole;
    this.subjectsJson = subjectsJson != null ? subjectsJson.trim() : "[]";
    this.locationRef = locationRef;
    this.startStateJson = startStateJson != null ? startStateJson.trim() : "{}";
    this.actionJson = actionJson != null ? actionJson.trim() : "{}";
    this.endStateJson = endStateJson != null ? endStateJson.trim() : "{}";
    this.compositionJson = compositionJson != null ? compositionJson.trim() : "{}";
    this.cameraJson = cameraJson != null ? cameraJson.trim() : "{}";
    this.subjectMotionJson = subjectMotionJson != null ? subjectMotionJson.trim() : "{}";
    this.cameraMotionJson = cameraMotionJson != null ? cameraMotionJson.trim() : "{}";
    this.environmentMotionJson =
        environmentMotionJson != null ? environmentMotionJson.trim() : "{}";
    this.targetDurationMs = Math.max(100, targetDurationMs);
    this.generationStrategy =
        generationStrategy != null ? generationStrategy : GenerationStrategy.TEXT_TO_VIDEO;
    this.qualityProfile = qualityProfile != null ? qualityProfile.trim() : "720p_24fps_standard";
    this.continuityFromShotId = continuityFromShotId;
    this.continuityToShotId = continuityToShotId;
    this.status = status != null ? status : ShotStatus.PLANNED;
  }

  public Shot withStatus(ShotStatus newStatus) {
    return new Shot(
        getId(),
        getRowVersion(),
        this.sequenceId,
        this.orderIndex,
        this.narrativePurpose,
        this.retentionRole,
        this.subjectsJson,
        this.locationRef,
        this.startStateJson,
        this.actionJson,
        this.endStateJson,
        this.compositionJson,
        this.cameraJson,
        this.subjectMotionJson,
        this.cameraMotionJson,
        this.environmentMotionJson,
        this.targetDurationMs,
        this.generationStrategy,
        this.qualityProfile,
        this.continuityFromShotId,
        this.continuityToShotId,
        newStatus);
  }
}
