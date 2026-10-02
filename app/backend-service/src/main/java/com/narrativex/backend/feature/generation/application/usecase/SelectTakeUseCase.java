package com.narrativex.backend.feature.generation.application.usecase;

import com.narrativex.backend.feature.assets.application.port.in.MediaAssetAccess;
import com.narrativex.backend.feature.common.exception.ResourceNotFoundException;
import com.narrativex.backend.feature.generation.application.port.out.SelectedTakeRepository;
import com.narrativex.backend.feature.generation.application.port.out.TakeRepository;
import com.narrativex.backend.feature.generation.application.port.out.TakeRepository.TakeRecord;
import com.narrativex.backend.feature.generation.domain.value.SelectedTake;
import com.narrativex.backend.feature.storyboard.application.port.in.StoryboardProductionAccess;
import com.narrativex.backend.feature.storyboard.application.port.in.StoryboardProductionAccess.ShotInfo;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Persists user's authoritative SelectedTake choice for a Shot with exact in/out trimming.
 * Validates project ownership, Take belonging, VIDEO output asset validity, and trim bounds.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class SelectTakeUseCase {
  private final StoryboardProductionAccess storyboardAccess;
  private final TakeRepository takeRepository;
  private final SelectedTakeRepository selectedTakeRepository;
  private final MediaAssetAccess mediaAssetAccess;

  @Transactional
  public SelectedTake execute(
      UUID projectId, UUID shotId, UUID takeId, long sourceInMs, long sourceOutMs) {
    Objects.requireNonNull(projectId, "projectId must not be null");
    Objects.requireNonNull(shotId, "shotId must not be null");
    Objects.requireNonNull(takeId, "takeId must not be null");

    // 1. Verify Shot belongs to project
    Optional<ShotInfo> shotOpt = storyboardAccess.findShot(projectId, shotId);
    if (shotOpt.isEmpty()) {
      throw new ResourceNotFoundException("Shot not found in project: " + shotId);
    }

    // 2. Verify Take belongs to Shot
    TakeRecord take =
        takeRepository
            .findById(takeId)
            .orElseThrow(() -> new IllegalArgumentException("Take " + takeId + " not found"));
    if (!shotId.equals(take.shotId())) {
      throw new IllegalArgumentException("Take " + takeId + " does not belong to Shot " + shotId);
    }

    // 3. Verify Take has VIDEO output asset
    if (take.outputAssetId() == null) {
      throw new IllegalStateException("Take has no output asset and cannot be selected");
    }
    MediaAssetAccess.MediaAssetSummary asset =
        mediaAssetAccess
            .findSummary(take.outputAssetId())
            .orElseThrow(() -> new IllegalStateException("Take output asset is missing"));
    if (!"VIDEO".equalsIgnoreCase(asset.type())) {
      throw new IllegalStateException("Take output asset is not a VIDEO asset");
    }

    // 4. Validate trim points
    if (sourceInMs < 0) {
      throw new IllegalArgumentException("sourceInMs must not be negative");
    }
    if (sourceOutMs <= sourceInMs) {
      throw new IllegalArgumentException("sourceOutMs must be strictly greater than sourceInMs");
    }
    if (take.sourceDurationMs() != null
        && take.sourceDurationMs() > 0
        && sourceOutMs > take.sourceDurationMs()) {
      throw new IllegalArgumentException(
          "sourceOutMs ("
              + sourceOutMs
              + "ms) exceeds take source duration ("
              + take.sourceDurationMs()
              + "ms)");
    }

    // 5. Persist to selected_takes
    selectedTakeRepository.saveSelection(shotId, takeId, sourceInMs, sourceOutMs);

    // 6. Update Shot status to SELECTED
    storyboardAccess.updateShotStatus(shotId, "SELECTED");
    log.info(
        "Persisted selected take {} for shot {} with trim [{}ms, {}ms]",
        takeId,
        shotId,
        sourceInMs,
        sourceOutMs);

    return new SelectedTake(shotId, takeId, sourceInMs, sourceOutMs);
  }
}
