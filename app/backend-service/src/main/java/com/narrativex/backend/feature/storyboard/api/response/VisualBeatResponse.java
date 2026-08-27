package com.narrativex.backend.feature.storyboard.api.response;

import com.narrativex.backend.feature.storyboard.domain.entity.VisualBeat;
import com.narrativex.backend.feature.storyboard.domain.enums.AspectRatio;
import com.narrativex.backend.feature.storyboard.domain.enums.CameraAngle;
import com.narrativex.backend.feature.storyboard.domain.enums.CameraMovement;
import com.narrativex.backend.feature.storyboard.domain.enums.ImageQualityTier;
import com.narrativex.backend.feature.storyboard.domain.enums.MotionMode;
import com.narrativex.backend.feature.storyboard.domain.enums.VisualBeatReviewStatus;
import java.util.UUID;

public record VisualBeatResponse(
    UUID id,
    UUID sceneId,
    int orderIndex,
    String title,
    String visualIntent,
    String prompt,
    MotionMode motionMode,
    CameraMovement cameraMovement,
    CameraAngle cameraAngle,
    VisualBeatReviewStatus reviewStatus,
    AspectRatio aspectRatioOverride,
    ImageQualityTier qualityTierOverride,
    long rowVersion) {
  public static VisualBeatResponse from(VisualBeat beat) {
    return new VisualBeatResponse(
        beat.getId(),
        beat.getSceneId(),
        beat.getOrderIndex(),
        beat.getTitle(),
        beat.getVisualIntent(),
        null,
        beat.getMotionMode(),
        beat.getCameraMovement(),
        beat.getCameraAngle(),
        beat.getReviewStatus(),
        beat.getAspectRatioOverride(),
        beat.getQualityTierOverride(),
        beat.getRowVersion());
  }

  public static VisualBeatResponse from(VisualBeat beat, String prompt) {
    return new VisualBeatResponse(
        beat.getId(),
        beat.getSceneId(),
        beat.getOrderIndex(),
        beat.getTitle(),
        beat.getVisualIntent(),
        prompt,
        beat.getMotionMode(),
        beat.getCameraMovement(),
        beat.getCameraAngle(),
        beat.getReviewStatus(),
        beat.getAspectRatioOverride(),
        beat.getQualityTierOverride(),
        beat.getRowVersion());
  }
}
