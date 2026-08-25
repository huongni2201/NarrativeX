package com.narrativex.backend.feature.generation.application.usecase;

import com.narrativex.backend.feature.auth.application.port.in.CurrentUserId;
import com.narrativex.backend.feature.generation.application.port.out.ProductionBeatMediaSelectionRepository;
import com.narrativex.backend.feature.generation.application.query.ProductionTimelineView;
import com.narrativex.backend.feature.generation.domain.enums.BeatMediaFitMode;
import com.narrativex.backend.feature.generation.domain.exception.GenerationAdmissionDeniedException;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class UpdateProductionBeatMediaUseCase {
  private final CurrentUserId currentUserId;
  private final GetProductionTimelineUseCase getProductionTimelineUseCase;
  private final ProductionBeatMediaSelectionRepository repository;

  @Transactional
  public void update(
      UUID projectId,
      UUID visualBeatId,
      UUID mediaAssetId,
      BeatMediaFitMode fitMode,
      long trimStartMs) {
    String ownerId = currentUserId.get();
    ProductionTimelineView timeline = getProductionTimelineUseCase.executeOwned(projectId, ownerId);
    ProductionTimelineView.Beat beat = requireBeat(timeline, visualBeatId);
    var asset =
        repository
            .findSelectableAsset(ownerId, mediaAssetId)
            .orElseThrow(
                () ->
                    new GenerationAdmissionDeniedException(
                        "INVALID_BEAT_MEDIA_SELECTION",
                        "The selected image/video asset is not READY or does not belong to this account."));

    BeatMediaFitMode normalizedFitMode = fitMode == null ? BeatMediaFitMode.TRIM : fitMode;
    if (trimStartMs < 0) {
      throw invalid("trimStartMs must be zero or positive.");
    }
    if ("IMAGE".equals(asset.mediaType())) {
      if (normalizedFitMode != BeatMediaFitMode.TRIM || trimStartMs != 0) {
        throw invalid("Image beats do not support video trim/loop/speed fit modes.");
      }
    } else {
      validateVideoFit(beat, asset.durationMs(), normalizedFitMode, trimStartMs);
    }

    repository.upsert(projectId, visualBeatId, mediaAssetId, normalizedFitMode, trimStartMs);
  }

  @Transactional
  public void clear(UUID projectId, UUID visualBeatId) {
    String ownerId = currentUserId.get();
    ProductionTimelineView timeline = getProductionTimelineUseCase.executeOwned(projectId, ownerId);
    requireBeat(timeline, visualBeatId);
    repository.clear(projectId, visualBeatId);
  }

  private static ProductionTimelineView.Beat requireBeat(
      ProductionTimelineView timeline, UUID visualBeatId) {
    return timeline.beats().stream()
        .filter(beat -> beat.visualBeatId().equals(visualBeatId))
        .findFirst()
        .orElseThrow(
            () ->
                new GenerationAdmissionDeniedException(
                    "INVALID_BEAT_MEDIA_SELECTION",
                    "Visual beat is not part of the current production timeline."));
  }

  private static void validateVideoFit(
      ProductionTimelineView.Beat beat,
      Long sourceDurationMs,
      BeatMediaFitMode fitMode,
      long trimStartMs) {
    if (sourceDurationMs != null && trimStartMs >= sourceDurationMs) {
      throw invalid("Video trim start must be before the source duration.");
    }
    long remaining =
        sourceDurationMs == null ? Long.MAX_VALUE : Math.max(0L, sourceDurationMs - trimStartMs);
    if (fitMode == BeatMediaFitMode.TRIM
        && sourceDurationMs != null
        && remaining < beat.durationMs()) {
      throw invalid(
          "Video is shorter than the narration span. Choose Loop, Freeze End or Speed Adjust.");
    }
    if (fitMode == BeatMediaFitMode.SPEED_ADJUST && sourceDurationMs == null) {
      throw invalid("Speed Adjust requires a known source video duration.");
    }
  }

  private static GenerationAdmissionDeniedException invalid(String message) {
    return new GenerationAdmissionDeniedException("INVALID_BEAT_MEDIA_SELECTION", message);
  }
}
