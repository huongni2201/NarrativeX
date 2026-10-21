package com.narrativex.backend.feature.storyboard.application.usecase;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.narrativex.backend.feature.common.domain.enums.GenerationStrategy;
import com.narrativex.backend.feature.common.domain.exception.DomainValidationException;
import com.narrativex.backend.feature.storyboard.application.model.ShotAudioCueAllocation;
import com.narrativex.backend.feature.storyboard.application.model.ShotAudioCueAllocationSet;
import com.narrativex.backend.feature.storyboard.application.port.in.StoryboardProductionAccess;
import com.narrativex.backend.feature.storyboard.application.port.out.ShotAudioCueAllocationRepository;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class ReplaceShotAudioCueAllocationsUseCaseTest {
  private final StoryboardProductionAccess storyboard = mock(StoryboardProductionAccess.class);
  private final ShotAudioCueAllocationRepository repository =
      mock(ShotAudioCueAllocationRepository.class);
  private final ReplaceShotAudioCueAllocationsUseCase useCase =
      new ReplaceShotAudioCueAllocationsUseCase(storyboard, repository);

  private final UUID projectId = UUID.randomUUID();
  private final UUID sequenceId = UUID.randomUUID();
  private final UUID visualBeatId = UUID.randomUUID();
  private final UUID storyBeatId = UUID.randomUUID();
  private final UUID firstShotId = UUID.randomUUID();
  private final UUID secondShotId = UUID.randomUUID();
  private final UUID firstCueId = UUID.randomUUID();
  private final UUID secondCueId = UUID.randomUUID();

  @BeforeEach
  void setUp() {
    var sequence = new StoryboardProductionAccess.ShotSequenceInfo(sequenceId, visualBeatId, 0);
    when(storyboard.findSequenceById(sequenceId)).thenReturn(Optional.of(sequence));
    when(storyboard.findSequenceByVisualBeatAndProject(projectId, visualBeatId))
        .thenReturn(Optional.of(sequence));
    when(storyboard.findVisualBeat(visualBeatId))
        .thenReturn(
            Optional.of(
                new StoryboardProductionAccess.VisualBeatInfo(
                    visualBeatId,
                    UUID.randomUUID(),
                    storyBeatId,
                    0,
                    "Beat",
                    "visual intent",
                    "APPROVED",
                    null,
                    "visual description")));
    when(storyboard.findAudioCues(List.of(storyBeatId)))
        .thenReturn(
            List.of(
                new StoryboardProductionAccess.AudioCueInfo(
                    firstCueId, storyBeatId, 0, "DIALOGUE", null, 4L),
                new StoryboardProductionAccess.AudioCueInfo(
                    secondCueId, storyBeatId, 1, "DIALOGUE", null, 7L)));
    when(storyboard.findShotsBySequence(sequenceId))
        .thenReturn(
            List.of(shot(firstShotId, 0), shot(secondShotId, 1), shot(UUID.randomUUID(), 2)));
  }

  @Test
  void assignsEachWholeCueToExactlyOneShotAndSnapshotsCueVersions() {
    List<ShotAudioCueAllocation> allocations =
        List.of(
            new ShotAudioCueAllocation(firstCueId, firstShotId, 4L),
            new ShotAudioCueAllocation(secondCueId, secondShotId, 7L));
    when(repository.replace(sequenceId, 0L, allocations))
        .thenReturn(new ShotAudioCueAllocationSet(sequenceId, 1L, allocations));

    var result =
        useCase.execute(
            projectId,
            sequenceId,
            0L,
            List.of(
                new ReplaceShotAudioCueAllocationsUseCase.Assignment(firstCueId, firstShotId),
                new ReplaceShotAudioCueAllocationsUseCase.Assignment(secondCueId, secondShotId)));

    assertThat(result.rowVersion()).isEqualTo(1L);
    assertThat(result.allocations()).containsExactlyElementsOf(allocations);
    verify(repository).replace(sequenceId, 0L, allocations);
  }

  @Test
  void blocksIncompleteAllocationForMultiShotSequence() {
    assertThatThrownBy(
            () ->
                useCase.execute(
                    projectId,
                    sequenceId,
                    0L,
                    List.of(
                        new ReplaceShotAudioCueAllocationsUseCase.Assignment(
                            firstCueId, firstShotId))))
        .isInstanceOf(DomainValidationException.class)
        .hasMessageContaining("AUDIO_CUE_ALLOCATION_INCOMPLETE");
  }

  @Test
  void rejectsShotOutsideSequence() {
    assertThatThrownBy(
            () ->
                useCase.execute(
                    projectId,
                    sequenceId,
                    0L,
                    List.of(
                        new ReplaceShotAudioCueAllocationsUseCase.Assignment(
                            firstCueId, UUID.randomUUID()),
                        new ReplaceShotAudioCueAllocationsUseCase.Assignment(
                            secondCueId, secondShotId))))
        .isInstanceOf(DomainValidationException.class)
        .hasMessageContaining("SHOT_OUTSIDE_SEQUENCE");
  }

  @Test
  void rejectsDuplicateCueOwnership() {
    assertThatThrownBy(
            () ->
                useCase.execute(
                    projectId,
                    sequenceId,
                    0L,
                    List.of(
                        new ReplaceShotAudioCueAllocationsUseCase.Assignment(
                            firstCueId, firstShotId),
                        new ReplaceShotAudioCueAllocationsUseCase.Assignment(
                            firstCueId, secondShotId),
                        new ReplaceShotAudioCueAllocationsUseCase.Assignment(
                            secondCueId, secondShotId))))
        .isInstanceOf(DomainValidationException.class)
        .hasMessageContaining("AUDIO_CUE_DUPLICATE_ALLOCATION");
  }

  @Test
  void rejectsCueAlreadyOwnedByAnotherSequence() {
    when(repository.findSequenceIdByAudioCueId(firstCueId))
        .thenReturn(Optional.of(UUID.randomUUID()));

    assertThatThrownBy(
            () ->
                useCase.execute(
                    projectId,
                    sequenceId,
                    0L,
                    List.of(
                        new ReplaceShotAudioCueAllocationsUseCase.Assignment(
                            firstCueId, firstShotId),
                        new ReplaceShotAudioCueAllocationsUseCase.Assignment(
                            secondCueId, secondShotId))))
        .isInstanceOf(DomainValidationException.class)
        .hasMessageContaining("AUDIO_CUE_ALREADY_ALLOCATED");
  }

  private StoryboardProductionAccess.ShotInfo shot(UUID shotId, int orderIndex) {
    return new StoryboardProductionAccess.ShotInfo(
        shotId,
        sequenceId,
        orderIndex,
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
  }
}
