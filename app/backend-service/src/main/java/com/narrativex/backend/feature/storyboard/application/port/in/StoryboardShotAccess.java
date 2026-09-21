package com.narrativex.backend.feature.storyboard.application.port.in;

import com.narrativex.backend.feature.common.domain.enums.GenerationStrategy;
import com.narrativex.backend.feature.storyboard.domain.entity.Shot;
import com.narrativex.backend.feature.storyboard.domain.entity.ShotSequence;
import com.narrativex.backend.feature.storyboard.domain.enums.RetentionRole;
import com.narrativex.backend.feature.storyboard.domain.enums.ShotStatus;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/** Cross-feature port exposing Shot and ShotSequence access to generation and production. */
public interface StoryboardShotAccess {

  record ShotView(
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

    public ShotView(
        UUID id,
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
          id,
          0L,
          null,
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

    public static ShotView from(Shot shot) {
      if (shot == null) return null;
      return new ShotView(
          shot.getId(),
          shot.getRowVersion(),
          shot.getSequenceId(),
          shot.getOrderIndex(),
          shot.getNarrativePurpose(),
          shot.getRetentionRole(),
          shot.getSubjectsJson(),
          shot.getLocationRef(),
          shot.getStartStateJson(),
          shot.getActionJson(),
          shot.getEndStateJson(),
          shot.getCompositionJson(),
          shot.getCameraJson(),
          shot.getSubjectMotionJson(),
          shot.getCameraMotionJson(),
          shot.getEnvironmentMotionJson(),
          shot.getTargetDurationMs(),
          shot.getGenerationStrategy(),
          shot.getQualityProfile(),
          shot.getContinuityFromShotId(),
          shot.getContinuityToShotId(),
          shot.getStatus());
    }
  }

  record ShotSequenceView(
      UUID id, long rowVersion, UUID visualBeatId, int orderIndex, List<ShotView> shots) {

    public static ShotSequenceView from(ShotSequence sequence) {
      if (sequence == null) return null;
      List<ShotView> shotViews =
          sequence.getShots() != null
              ? sequence.getShots().stream().map(ShotView::from).toList()
              : List.of();
      return new ShotSequenceView(
          sequence.getId(),
          sequence.getRowVersion(),
          sequence.getVisualBeatId(),
          sequence.getOrderIndex(),
          shotViews);
    }
  }

  List<ShotView> requireCurrentShots(UUID projectId, UUID chapterId);

  Optional<ShotView> findShotById(UUID projectId, UUID shotId);

  Optional<ShotSequenceView> findSequenceByBeatId(UUID projectId, UUID visualBeatId);

  void updateShotStatus(UUID shotId, ShotStatus status);
}
