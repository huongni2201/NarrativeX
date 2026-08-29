package com.narrativex.backend.feature.generation.application.usecase;

import com.narrativex.backend.feature.auth.application.port.in.CurrentUserId;
import com.narrativex.backend.feature.generation.application.command.RenderBeatOverride;
import com.narrativex.backend.feature.generation.application.port.out.ProductionBeatMediaSelectionRepository;
import com.narrativex.backend.feature.generation.application.port.out.ProductionBeatMediaSelectionRepository.SelectableMediaAsset;
import com.narrativex.backend.feature.generation.application.query.ProductionTimelineView;
import com.narrativex.backend.feature.generation.domain.enums.BeatMediaFitMode;
import com.narrativex.backend.feature.generation.domain.exception.GenerationAdmissionDeniedException;
import java.util.ArrayList;
import java.util.List;
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
    SelectableMediaAsset asset = requireSelectableAsset(projectId, ownerId, mediaAssetId);
    BeatMediaFitMode normalizedFitMode = fitMode == null ? BeatMediaFitMode.TRIM : fitMode;
    validateSelection(beat.durationMs(), asset, normalizedFitMode, trimStartMs);
    repository.upsert(projectId, visualBeatId, mediaAssetId, normalizedFitMode, trimStartMs);
  }

  /**
   * Validates every render-scoped fit/trim change before writing any of them. The caller is expected
   * to invoke this inside the same transaction that creates the render job so admission failures
   * roll the media edits back as one unit.
   */
  @Transactional
  public void applyRenderOverrides(UUID projectId, List<RenderBeatOverride> overrides) {
    if (overrides == null
        || overrides.stream().noneMatch(value -> value.fitMode() != null || value.trimStartMs() != null)) {
      return;
    }

    String ownerId = currentUserId.get();
    ProductionTimelineView timeline = getProductionTimelineUseCase.executeOwned(projectId, ownerId);
    List<PendingMediaUpdate> pending = new ArrayList<>();

    for (RenderBeatOverride override : overrides) {
      if (override.fitMode() == null && override.trimStartMs() == null) continue;
      ProductionTimelineView.Beat beat = requireBeat(timeline, override.visualBeatId());
      if (beat.mediaAssetId() == null) {
        throw invalid("Auto Edit cannot fit a beat without a selected media asset.");
      }
      SelectableMediaAsset asset = requireSelectableAsset(projectId, ownerId, beat.mediaAssetId());
      BeatMediaFitMode fitMode =
          override.fitMode() == null
              ? currentFitMode(beat)
              : BeatMediaFitMode.valueOf(override.fitMode());
      long trimStartMs =
          override.trimStartMs() == null ? beat.trimStartMs() : override.trimStartMs();
      long effectiveDurationMs =
          override.durationMs() == null ? beat.durationMs() : override.durationMs();
      validateSelection(effectiveDurationMs, asset, fitMode, trimStartMs);
      pending.add(
          new PendingMediaUpdate(
              override.visualBeatId(), beat.mediaAssetId(), fitMode, trimStartMs));
    }

    for (PendingMediaUpdate update : pending) {
      repository.upsert(
          projectId,
          update.visualBeatId(),
          update.mediaAssetId(),
          update.fitMode(),
          update.trimStartMs());
    }
  }

  @Transactional
  public void clear(UUID projectId, UUID visualBeatId) {
    String ownerId = currentUserId.get();
    ProductionTimelineView timeline = getProductionTimelineUseCase.executeOwned(projectId, ownerId);
    requireBeat(timeline, visualBeatId);
    repository.clear(projectId, visualBeatId);
  }

  private SelectableMediaAsset requireSelectableAsset(
      UUID projectId, String ownerId, UUID mediaAssetId) {
    return repository
        .findSelectableAsset(projectId, ownerId, mediaAssetId)
        .orElseThrow(
            () ->
                new GenerationAdmissionDeniedException(
                    "INVALID_BEAT_MEDIA_SELECTION",
                    "The selected image/video asset is not READY, unavailable in this project, or does not belong to this account."));
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

  private static BeatMediaFitMode currentFitMode(ProductionTimelineView.Beat beat) {
    if (beat.fitMode() == null || beat.fitMode().isBlank()) return BeatMediaFitMode.TRIM;
    try {
      return BeatMediaFitMode.valueOf(beat.fitMode());
    } catch (IllegalArgumentException exception) {
      throw invalid("Visual beat has an unsupported current fit mode.");
    }
  }

  private static void validateSelection(
      long effectiveDurationMs,
      SelectableMediaAsset asset,
      BeatMediaFitMode fitMode,
      long trimStartMs) {
    if (trimStartMs < 0) {
      throw invalid("trimStartMs must be zero or positive.");
    }
    if ("IMAGE".equals(asset.mediaType())) {
      if (fitMode != BeatMediaFitMode.TRIM || trimStartMs != 0) {
        throw invalid("Image beats do not support video trim/loop/speed fit modes.");
      }
      return;
    }
    validateVideoFit(effectiveDurationMs, asset.durationMs(), fitMode, trimStartMs);
  }

  private static void validateVideoFit(
      long effectiveDurationMs,
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
        && remaining < effectiveDurationMs) {
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

  private record PendingMediaUpdate(
      UUID visualBeatId,
      UUID mediaAssetId,
      BeatMediaFitMode fitMode,
      long trimStartMs) {}
}
