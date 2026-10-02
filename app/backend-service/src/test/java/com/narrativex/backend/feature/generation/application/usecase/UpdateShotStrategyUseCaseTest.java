package com.narrativex.backend.feature.generation.application.usecase;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.narrativex.backend.feature.common.domain.enums.GenerationStrategy;
import com.narrativex.backend.feature.common.exception.ResourceNotFoundException;
import com.narrativex.backend.feature.storyboard.application.port.in.StoryboardProductionAccess;
import com.narrativex.backend.feature.storyboard.application.port.in.StoryboardProductionAccess.ShotInfo;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class UpdateShotStrategyUseCaseTest {
  private final StoryboardProductionAccess storyboardAccess =
      mock(StoryboardProductionAccess.class);
  private final UpdateShotStrategyUseCase useCase = new UpdateShotStrategyUseCase(storyboardAccess);

  @Test
  void updatesValidStrategy() {
    UUID projectId = UUID.randomUUID();
    UUID shotId = UUID.randomUUID();

    ShotInfo shot =
        new ShotInfo(
            shotId,
            UUID.randomUUID(),
            1,
            "purpose",
            "HOOK",
            List.of(),
            null,
            "{}",
            "{}",
            "{}",
            "{}",
            "{}",
            "{}",
            "{}",
            "{}",
            4000L,
            GenerationStrategy.TEXT_TO_VIDEO,
            "STANDARD",
            "READY");
    when(storyboardAccess.findShot(projectId, shotId)).thenReturn(Optional.of(shot));

    useCase.execute(projectId, shotId, GenerationStrategy.IMAGE_TO_VIDEO);

    verify(storyboardAccess).updateShotStrategy(shotId, GenerationStrategy.IMAGE_TO_VIDEO);
  }

  @Test
  void rejectsUnsupportedStrategy() {
    UUID projectId = UUID.randomUUID();
    UUID shotId = UUID.randomUUID();

    ShotInfo shot =
        new ShotInfo(
            shotId,
            UUID.randomUUID(),
            1,
            "purpose",
            "HOOK",
            List.of(),
            null,
            "{}",
            "{}",
            "{}",
            "{}",
            "{}",
            "{}",
            "{}",
            "{}",
            4000L,
            GenerationStrategy.TEXT_TO_VIDEO,
            "STANDARD",
            "READY");
    when(storyboardAccess.findShot(projectId, shotId)).thenReturn(Optional.of(shot));

    assertThatThrownBy(() -> useCase.execute(projectId, shotId, GenerationStrategy.MULTI_KEYFRAME))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("not supported");
  }

  @Test
  void rejectsWhenShotNotFound() {
    UUID projectId = UUID.randomUUID();
    UUID shotId = UUID.randomUUID();

    when(storyboardAccess.findShot(projectId, shotId)).thenReturn(Optional.empty());

    assertThatThrownBy(() -> useCase.execute(projectId, shotId, GenerationStrategy.TEXT_TO_VIDEO))
        .isInstanceOf(ResourceNotFoundException.class);
  }
}
