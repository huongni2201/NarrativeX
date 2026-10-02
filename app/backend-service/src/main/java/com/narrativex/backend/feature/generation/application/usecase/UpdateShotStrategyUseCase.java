package com.narrativex.backend.feature.generation.application.usecase;

import com.narrativex.backend.feature.common.domain.enums.GenerationStrategy;
import com.narrativex.backend.feature.common.exception.ResourceNotFoundException;
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
 * Updates a Shot's generation strategy. Enforces runtime strategy boundaries: only actively
 * supported strategies (TEXT_TO_VIDEO, IMAGE_TO_VIDEO, FIRST_LAST_FRAME) can be persisted.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class UpdateShotStrategyUseCase {
  private final StoryboardProductionAccess storyboardAccess;

  @Transactional
  public void execute(UUID projectId, UUID shotId, GenerationStrategy strategy) {
    Objects.requireNonNull(projectId, "projectId must not be null");
    Objects.requireNonNull(shotId, "shotId must not be null");
    Objects.requireNonNull(strategy, "strategy must not be null");

    Optional<ShotInfo> shotOpt = storyboardAccess.findShot(projectId, shotId);
    if (shotOpt.isEmpty()) {
      throw new ResourceNotFoundException("Shot not found in project: " + shotId);
    }

    if (strategy != GenerationStrategy.TEXT_TO_VIDEO
        && strategy != GenerationStrategy.IMAGE_TO_VIDEO
        && strategy != GenerationStrategy.FIRST_LAST_FRAME) {
      throw new IllegalArgumentException(
          "Generation strategy " + strategy + " is not supported by current video runtime.");
    }

    storyboardAccess.updateShotStrategy(shotId, strategy);
    log.info("Updated shot {} strategy to {}", shotId, strategy);
  }
}
