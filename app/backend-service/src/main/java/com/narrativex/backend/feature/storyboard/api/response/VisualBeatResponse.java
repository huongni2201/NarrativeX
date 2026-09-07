package com.narrativex.backend.feature.storyboard.api.response;

import com.narrativex.backend.feature.storyboard.domain.entity.VisualBeat;
import com.narrativex.backend.feature.storyboard.domain.enums.AspectRatio;
import com.narrativex.backend.feature.storyboard.domain.enums.MotionMode;
import com.narrativex.backend.feature.storyboard.domain.enums.VisualBeatReviewStatus;
import java.util.UUID;

public record VisualBeatResponse(
    UUID id,
    UUID sceneId,
    int orderIndex,
    String title,
    String visualIntent,
    String visualDirectionJson,
    String prompt,
    MotionMode motionMode,
    VisualBeatReviewStatus reviewStatus,
    AspectRatio aspectRatioOverride,
    UUID previewMediaAssetId,
    long rowVersion) {
  public static VisualBeatResponse from(VisualBeat beat) {
    return new VisualBeatResponse(
        beat.getId(),
        beat.getSceneId(),
        beat.getOrderIndex(),
        beat.getTitle(),
        beat.getVisualIntent(),
        beat.getVisualDirectionJson(),
        null,
        beat.getMotionMode(),
        beat.getReviewStatus(),
        beat.getAspectRatioOverride(),
        beat.getPreviewMediaAssetId(),
        beat.getRowVersion());
  }

  public static VisualBeatResponse from(VisualBeat beat, String prompt) {
    return new VisualBeatResponse(
        beat.getId(),
        beat.getSceneId(),
        beat.getOrderIndex(),
        beat.getTitle(),
        beat.getVisualIntent(),
        beat.getVisualDirectionJson(),
        prompt,
        beat.getMotionMode(),
        beat.getReviewStatus(),
        beat.getAspectRatioOverride(),
        beat.getPreviewMediaAssetId(),
        beat.getRowVersion());
  }
}
