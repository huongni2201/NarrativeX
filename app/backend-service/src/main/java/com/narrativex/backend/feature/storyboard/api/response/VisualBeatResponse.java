package com.narrativex.backend.feature.storyboard.api.response;

import com.narrativex.backend.feature.storyboard.domain.entity.VisualBeat;
import com.narrativex.backend.feature.storyboard.domain.enums.AspectRatio;
import com.narrativex.backend.feature.storyboard.domain.enums.ImageQualityTier;
import com.narrativex.backend.feature.storyboard.domain.enums.MotionAction;
import com.narrativex.backend.feature.storyboard.domain.enums.VisualBeatReviewStatus;

public record VisualBeatResponse(
    Long id,
    Long sceneId,
    int orderIndex,
    String title,
    String visualIntent,
    VisualBeatReviewStatus reviewStatus,
    MotionAction motionAction,
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
        beat.getReviewStatus(),
        beat.getMotionAction(),
        beat.getAspectRatioOverride(),
        beat.getQualityTierOverride(),
        beat.getRowVersion());
  }
}
